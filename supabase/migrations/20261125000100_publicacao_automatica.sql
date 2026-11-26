-- Publicação automática: a questão que passa nas checagens vai ao ar sozinha.
-- O painel editorial deixa de exigir amostra e vira uma caixa de exceções.

-- Motivo para a questão ter ficado fora do ar ("precisa de olho"). Null quando não há dúvida.
alter table questions add column hold_reason text;

-- Revisão médica opcional, feita depois de publicar. É o que dá o selo "Revisada por médico".
alter table questions add column reviewed_by uuid references profiles (id) on delete set null;
alter table questions add column reviewed_at timestamptz;

create index questions_status on questions (status);

-- Quarentena automática mais sensível: 3 denúncias distintas abertas (antes eram 5),
-- ou discriminação negativa clara.
create or replace function public.check_quarantine(p_question uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_reports integer;
  s item_stats%rowtype;
  v_discrimination numeric;
begin
  select count(distinct user_id) into v_reports from reports
    where question_id = p_question and status = 'aberta'
      and kind in ('gabarito', 'desatualizada', 'enunciado', 'comentario');
  select * into s from item_stats where question_id = p_question;
  if s.upper_n >= 25 and s.lower_n >= 25 then
    v_discrimination := s.upper_correct::numeric / s.upper_n - s.lower_correct::numeric / s.lower_n;
  end if;
  if v_reports >= 3 or (v_discrimination is not null and v_discrimination < -0.1) then
    update questions
      set status = 'quarantined',
          hold_reason = case when v_reports >= 3 then format('%s denúncias de alunos', v_reports) else 'Estatística de acerto incoerente' end
      where id = p_question and status = 'published';
    return found;
  end if;
  return false;
end $$;

-- Questão vencida sai do ar sozinha. Chamada pelo cron.
create function public.retire_expired_questions() returns integer
language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  update questions
    set status = 'retired', hold_reason = 'Passou da data de validade'
    where status = 'published' and expires_on is not null and expires_on < current_date;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Só o servidor chama.
revoke all on function public.retire_expired_questions() from public, anon, authenticated;
grant execute on function public.retire_expired_questions() to service_role;
