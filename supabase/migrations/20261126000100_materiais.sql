-- Material de apoio privado (dossiê, provas comentadas, material produzido em parceria).
-- Serve de base para o gerador de questões. Nunca é mostrado ao aluno: só o servidor lê.

create table material_chunks (
  id text primary key,                 -- hash do arquivo + páginas
  origem text not null,                -- coleção (ex.: "ApMed Reta Final 2027", "Sprint ENAMED")
  arquivo text not null,               -- caminho relativo dentro de materiais-privados/
  pagina_inicio integer not null,
  pagina_fim integer not null,
  texto text not null,
  -- Preenchidos pela classificação (scripts/materials-classify.ts)
  tipo text check (tipo in ('teoria', 'questao_comentada', 'questao_sem_comentario', 'indice', 'outro')),
  area_id text references matrix_areas (id),
  tema text,                           -- tema do content/temas/temario.json, ou null se nenhum serve
  assunto text,                        -- assunto livre em poucas palavras
  classificado_em timestamptz,
  created_at timestamptz not null default now()
);
create index material_chunks_tema on material_chunks (tema) where tema is not null;
create index material_chunks_pendentes on material_chunks (created_at) where classificado_em is null;

-- De quais trechos cada questão gerada saiu. Só para o painel editorial.
create table question_materials (
  question_id uuid not null references questions (id) on delete cascade,
  chunk_id text not null references material_chunks (id) on delete cascade,
  primary key (question_id, chunk_id)
);

-- Fechado: sem nenhuma política, só a chave de servidor acessa.
alter table material_chunks enable row level security;
alter table question_materials enable row level security;
