-- Seu dia: metas de estudo de cada pessoa. O plano do dia é calculado no servidor a cada
-- carregamento a partir destas metas; nada do plano em si é gravado.

alter table profiles
  add column daily_minutes smallint not null default 60,
  add column target_exam text not null default 'enamed',
  add column exam_date date,
  add column goals_set boolean not null default false,
  add constraint daily_minutes_range check (daily_minutes between 15 and 300),
  add constraint target_exam_known check (target_exam in ('enamed', 'enare'));
