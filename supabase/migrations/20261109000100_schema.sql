-- EnaQuest: esquema base.
-- Regra central: o navegador nunca lê conteúdo pago nem gabarito direto do banco.
-- Toda leitura sensível passa pelo servidor (service role), depois de checar sessão e acesso.

create type question_status as enum ('draft', 'in_review', 'published', 'quarantined', 'retired');
create type verification_status as enum ('ia_verificada', 'lote_amostrado', 'medico_revisado');
create type question_origin as enum ('original_ia', 'oficial_inep');
create type license_status as enum ('proprio', 'pendente', 'liberado', 'bloqueado');
create type difficulty_level as enum ('facil', 'medio', 'dificil', 'muito_dificil');
create type answer_mode as enum ('daily', 'training', 'review', 'simulado');
create type confidence_level as enum ('certeza', 'duvida', 'chute');
create type error_reason as enum ('conteudo', 'leitura', 'pressa', 'chute', 'entre_duas');
create type lot_status as enum ('pending_review', 'approved', 'held', 'rejected');
create type review_decision as enum ('ok', 'minor', 'critical');
create type appeal_status as enum ('aberto', 'deferido', 'indeferido');
create type report_status as enum ('aberta', 'resolvida', 'descartada');

-- ---------- Referência ----------
create table exam_tracks (
  id text primary key,
  name text not null,
  options_count smallint not null,
  questions_count smallint not null,
  duration_minutes smallint not null,
  active boolean not null default true
);

create table matrix_areas (
  id text primary key,
  name text not null,
  short_name text not null,
  color text not null,
  sort_order smallint not null,
  exam_share numeric(4, 3) not null
);

create table competencies (
  id text primary key,
  name text not null
);

create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  uf char(2),
  active boolean not null default true,
  unique (name, city)
);

create table sources (
  id text primary key,
  title text not null,
  publisher text not null,
  year smallint not null,
  url text not null,
  checked_on date not null
);

-- ---------- Usuários ----------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null unique,
  school_id uuid references schools (id) on delete set null,
  show_school boolean not null default false,
  role text not null default 'student' check (role in ('student', 'editor', 'admin')),
  league_tier smallint not null default 0,
  placement_done boolean not null default false,
  created_at timestamptz not null default now()
);

create table rating_state (
  user_id uuid primary key references profiles (id) on delete cascade,
  rating numeric(7, 2) not null default 900,
  peak numeric(7, 2) not null default 900,
  games integer not null default 0,
  combo integer not null default 0,
  best_combo integer not null default 0,
  xp_total integer not null default 0
);

create table streaks (
  user_id uuid primary key references profiles (id) on delete cascade,
  current integer not null default 0,
  best integer not null default 0,
  last_active date,
  shields smallint not null default 1
);

create table entitlements (
  user_id uuid primary key references profiles (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  access_until timestamptz,
  payment_problem boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ---------- Conteúdo ----------
create table review_lots (
  id text primary key,
  area_id text references matrix_areas (id),
  status lot_status not null default 'pending_review',
  sample_size smallint not null default 59,
  notes text,
  held_reason text,
  decided_by uuid references profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  track_id text not null references exam_tracks (id),
  area_id text not null references matrix_areas (id),
  competency_id text not null references competencies (id),
  theme text not null,
  scenario text not null,
  difficulty difficulty_level not null,
  rating numeric(7, 2) not null,
  stem text not null,
  exams jsonb,
  options jsonb not null,
  status question_status not null default 'draft',
  verification verification_status not null default 'ia_verificada',
  origin question_origin not null default 'original_ia',
  license license_status not null default 'proprio',
  risk_level text not null default 'normal' check (risk_level in ('normal', 'alto')),
  lot_id text references review_lots (id),
  expires_on date,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  constraint options_is_array check (jsonb_typeof(options) = 'array')
);
create index questions_area_status on questions (area_id, status);
create index questions_lot on questions (lot_id);

-- Gabarito e comentário ficam fora de `questions`, sem nenhuma política de leitura.
create table question_keys (
  question_id uuid primary key references questions (id) on delete cascade,
  correct_index smallint not null
);

create table explanations (
  question_id uuid primary key references questions (id) on delete cascade,
  quick text not null,
  reasoning text not null,
  distractors jsonb not null,
  tip text not null,
  pearl text not null,
  competency_note text not null
);

create table question_sources (
  question_id uuid not null references questions (id) on delete cascade,
  source_id text not null references sources (id),
  locator text,
  primary key (question_id, source_id)
);

create table review_samples (
  lot_id text not null references review_lots (id) on delete cascade,
  question_id uuid not null references questions (id) on delete cascade,
  decision review_decision,
  notes text,
  reviewer_id uuid references profiles (id) on delete set null,
  decided_at timestamptz,
  primary key (lot_id, question_id)
);

create table item_stats (
  question_id uuid primary key references questions (id) on delete cascade,
  n integer not null default 0,
  correct integer not null default 0,
  option_counts integer[] not null default '{0,0,0,0}',
  upper_n integer not null default 0,
  upper_correct integer not null default 0,
  lower_n integer not null default 0,
  lower_correct integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------- Estudo ----------
create table daily_challenges (
  day date primary key,
  question_ids uuid[] not null
);

create table answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  question_id uuid not null references questions (id) on delete cascade,
  mode answer_mode not null,
  context text not null,
  selected smallint not null,
  is_correct boolean not null,
  confidence confidence_level,
  error_reason error_reason,
  ms integer,
  rating_delta numeric(6, 2) not null default 0,
  xp integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, question_id, mode, context)
);
create index answers_user_time on answers (user_id, created_at desc);
create index answers_user_question on answers (user_id, question_id);

create table srs_cards (
  user_id uuid not null references profiles (id) on delete cascade,
  question_id uuid not null references questions (id) on delete cascade,
  state jsonb not null,
  due timestamptz not null,
  primary key (user_id, question_id)
);
create index srs_due on srs_cards (user_id, due);

create table simulados (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null default 'nacional' check (kind in ('nacional', 'livre')),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  duration_minutes smallint not null default 300,
  question_ids uuid[] not null,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table simulado_attempts (
  id uuid primary key default gen_random_uuid(),
  simulado_id uuid not null references simulados (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  deadline timestamptz not null,
  answers jsonb not null default '{}',
  flags jsonb not null default '[]',
  finished_at timestamptz,
  correct integer,
  total integer,
  unique (simulado_id, user_id)
);

create table boletins (
  user_id uuid primary key references profiles (id) on delete cascade,
  edition smallint not null,
  score numeric(6, 2) not null,
  proficient boolean,
  consent_at timestamptz not null default now()
);

-- ---------- Jogo ----------
create table xp_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles (id) on delete cascade,
  amount integer not null,
  kind text not null,
  ref text not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref)
);
create index xp_user_time on xp_ledger (user_id, created_at desc);

create table achievements (
  user_id uuid not null references profiles (id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table league_members (
  week_start date not null,
  user_id uuid not null references profiles (id) on delete cascade,
  tier smallint not null,
  group_no integer not null,
  xp integer not null default 0,
  outcome text check (outcome in ('sobe', 'fica', 'desce')),
  primary key (week_start, user_id)
);
create index league_group on league_members (week_start, tier, group_no, xp desc);

create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  owner_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table group_members (
  group_id uuid not null references groups (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- ---------- Comunidade ----------
create table comments (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  body text not null check (char_length(body) between 3 and 1500),
  votes integer not null default 0,
  pinned boolean not null default false,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index comments_question on comments (question_id, pinned desc, votes desc);

create table comment_votes (
  comment_id uuid not null references comments (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  primary key (comment_id, user_id)
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references questions (id) on delete cascade,
  comment_id uuid references comments (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  kind text not null check (kind in ('gabarito', 'desatualizada', 'enunciado', 'comentario', 'ofensivo', 'outro')),
  body text check (char_length(body) <= 1000),
  status report_status not null default 'aberta',
  created_at timestamptz not null default now()
);
create unique index reports_one_per_user on reports (user_id, coalesce(question_id, comment_id), kind);

create table appeals (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  argument text not null check (char_length(argument) between 20 and 2000),
  status appeal_status not null default 'aberto',
  triage jsonb,
  decision_note text,
  decided_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (question_id, user_id)
);

-- ---------- Cobrança ----------
create table stripe_customers (
  user_id uuid primary key references profiles (id) on delete cascade,
  stripe_customer_id text not null unique
);

create table subscriptions (
  id text primary key,
  user_id uuid not null references profiles (id) on delete cascade,
  status text not null,
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  first_paid_at timestamptz,
  updated_at timestamptz not null default now()
);
create index subscriptions_user on subscriptions (user_id);

create table payments (
  id text primary key,
  user_id uuid not null references profiles (id) on delete cascade,
  subscription_id text,
  charge_id text,
  amount integer not null,
  currency text not null,
  status text not null,
  paid_at timestamptz,
  refunded_at timestamptz
);
create index payments_charge on payments (charge_id);

create table stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

-- ---------- Infra ----------
create table app_config (
  key text primary key,
  value jsonb not null
);

create table rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

-- ---------- RLS: tudo fechado, com leitura apenas do que é do próprio usuário ----------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy read_reference on exam_tracks for select to authenticated using (true);
create policy read_reference on matrix_areas for select to authenticated using (true);
create policy read_reference on competencies for select to authenticated using (true);
create policy read_reference on schools for select to authenticated using (active);

create policy own_row on profiles for select to authenticated using (id = auth.uid());
create policy own_row on rating_state for select to authenticated using (user_id = auth.uid());
create policy own_row on streaks for select to authenticated using (user_id = auth.uid());
create policy own_row on entitlements for select to authenticated using (user_id = auth.uid());
create policy own_row on answers for select to authenticated using (user_id = auth.uid());
create policy own_row on srs_cards for select to authenticated using (user_id = auth.uid());
create policy own_row on simulado_attempts for select to authenticated using (user_id = auth.uid());
create policy own_row on boletins for select to authenticated using (user_id = auth.uid());
create policy own_row on xp_ledger for select to authenticated using (user_id = auth.uid());
create policy own_row on achievements for select to authenticated using (user_id = auth.uid());
create policy own_row on league_members for select to authenticated using (user_id = auth.uid());
create policy own_row on group_members for select to authenticated using (user_id = auth.uid());
create policy own_row on subscriptions for select to authenticated using (user_id = auth.uid());
create policy own_row on payments for select to authenticated using (user_id = auth.uid());

-- Camada extra para o que é mais sensível: nem o papel autenticado tem privilégio.
revoke all on question_keys, explanations, stripe_events, rate_limits, app_config, review_samples, review_lots
  from anon, authenticated;

-- ---------- Novo usuário ----------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, nickname)
  values (new.id, 'plantonista_' || substr(replace(new.id::text, '-', ''), 1, 8));
  insert into rating_state (user_id) values (new.id);
  insert into streaks (user_id) values (new.id);
  insert into entitlements (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
