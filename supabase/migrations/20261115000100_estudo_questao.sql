-- Estudo da questão: comentário da alternativa correta, revisão do tema e resumo,
-- além de avaliação da questão e marcação para rever.

-- Campos opcionais: questões antigas continuam válidas sem eles.
alter table explanations
  add column key_why text,
  add column theory jsonb,
  add column summary jsonb;

create table question_feedback (
  user_id uuid not null references profiles (id) on delete cascade,
  question_id uuid not null references questions (id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);
create index question_feedback_question on question_feedback (question_id);

create table question_marks (
  user_id uuid not null references profiles (id) on delete cascade,
  question_id uuid not null references questions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

-- Mesmo padrão das outras tabelas: leitura só do que é seu, escrita só pelo servidor.
alter table question_feedback enable row level security;
alter table question_marks enable row level security;
create policy own_row on question_feedback for select to authenticated using (user_id = auth.uid());
create policy own_row on question_marks for select to authenticated using (user_id = auth.uid());
