-- Provas oficiais (ENAMED/Inep e ENARE/Ebserh) dentro do mesmo banco de questões.
-- A questão oficial guarda de qual prova veio e o número dela no caderno, para aparecer como
-- "ENAMED 2025 · Q37". Questão anulada e questão desatualizada ficam no banco, mas fora das rodadas.

alter type question_origin add value if not exists 'oficial_ebserh';

create type answer_key_status as enum ('preliminar', 'definitivo');

create table official_exams (
  id text primary key,                                   -- ex.: enamed-2025-c1
  track_id text not null references exam_tracks (id),
  board text not null,                                   -- quem aplica: Inep, Ebserh/FGV
  name text not null,                                    -- como aparece para o aluno: ENAMED 2025
  year smallint not null check (year between 2000 and 2100),
  booklet text,                                          -- Caderno 01, Tipo 1...
  applied_on date,
  key_status answer_key_status not null default 'preliminar',
  booklet_url text,
  key_url text,
  created_at timestamptz not null default now()
);

alter table official_exams enable row level security;
create policy read_reference on official_exams for select to authenticated using (true);

alter table questions
  add column official_exam_id text references official_exams (id),
  add column official_number smallint check (official_number > 0),
  -- Anulada pela banca: fica para consulta, nunca entra em rodada nem conta no rating.
  add column annulled boolean not null default false,
  add column annulled_note text,
  -- Diretriz mudou depois da prova: o gabarito da época não vale mais como conduta.
  add column outdated_note text,
  -- Figuras do enunciado (ECG, imagem, foto): [{ src, alt, caption? }].
  add column images jsonb,
  add constraint official_number_needs_exam check ((official_exam_id is null) = (official_number is null)),
  add constraint annulled_only_official check (not annulled or official_exam_id is not null),
  add constraint images_is_array check (images is null or jsonb_typeof(images) = 'array');

create unique index questions_official_number on questions (official_exam_id, official_number) where official_exam_id is not null;

-- Questão anulada não tem gabarito válido.
alter table question_keys alter column correct_index drop not null;

-- Figuras das questões: leitura pública (são parte do enunciado), escrita só pelo servidor.
insert into storage.buckets (id, name, public)
values ('question-media', 'question-media', true)
on conflict (id) do nothing;
