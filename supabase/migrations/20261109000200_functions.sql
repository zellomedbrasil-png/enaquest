-- Funções atômicas chamadas apenas pelo servidor (service role).
-- O cálculo de rating, XP, sequência e revisão fica em TypeScript puro e testado;
-- aqui só garantimos que tudo é gravado junto, uma única vez.

create function public.week_start_br(ts timestamptz default now()) returns date
language sql stable as $$
  select (date_trunc('week', ts at time zone 'America/Sao_Paulo'))::date
$$;

-- Coloca o usuário em um grupo de liga da semana, com no máximo 30 pessoas.
create function public.ensure_league_member(p_user uuid, p_week date) returns void
language plpgsql security definer set search_path = public as $$
declare v_tier smallint; v_group integer;
begin
  if exists (select 1 from league_members where week_start = p_week and user_id = p_user) then
    return;
  end if;
  select league_tier into v_tier from profiles where id = p_user;
  perform pg_advisory_xact_lock(hashtext('league' || p_week::text || v_tier::text));
  select group_no into v_group from league_members
    where week_start = p_week and tier = v_tier
    group by group_no having count(*) < 30
    order by group_no limit 1;
  if v_group is null then
    select coalesce(max(group_no), 0) + 1 into v_group from league_members
      where week_start = p_week and tier = v_tier;
  end if;
  insert into league_members (week_start, user_id, tier, group_no)
  values (p_week, p_user, v_tier, v_group)
  on conflict do nothing;
end $$;

-- Lançamento único de XP: a mesma origem nunca pontua duas vezes.
create function public.award_xp(p_user uuid, p_amount integer, p_kind text, p_ref text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_inserted integer; v_week date := week_start_br();
begin
  if p_amount <= 0 then return false; end if;
  insert into xp_ledger (user_id, amount, kind, ref)
  values (p_user, p_amount, p_kind, p_ref)
  on conflict (user_id, kind, ref) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return false; end if;
  update rating_state set xp_total = xp_total + p_amount where user_id = p_user;
  perform ensure_league_member(p_user, v_week);
  update league_members set xp = xp + p_amount where week_start = v_week and user_id = p_user;
  return true;
end $$;

-- Quarentena automática: 5 denúncias distintas abertas, ou discriminação negativa clara.
create function public.check_quarantine(p_question uuid) returns boolean
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
  if v_reports >= 5 or (v_discrimination is not null and v_discrimination < -0.1) then
    update questions set status = 'quarantined' where id = p_question and status = 'published';
    return found;
  end if;
  return false;
end $$;

-- Grava uma resposta e todos os efeitos dela de uma vez.
create function public.apply_answer(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := (p ->> 'user_id')::uuid;
  v_question uuid := (p ->> 'question_id')::uuid;
  v_selected smallint := (p ->> 'selected')::smallint;
  v_correct boolean := (p ->> 'is_correct')::boolean;
  v_answer uuid;
  v_xp jsonb;
  v_bucket text := p ->> 'bucket';
begin
  insert into answers (user_id, question_id, mode, context, selected, is_correct, confidence, ms, rating_delta, xp)
  values (
    v_user, v_question, (p ->> 'mode')::answer_mode, p ->> 'context', v_selected, v_correct,
    (p ->> 'confidence')::confidence_level, (p ->> 'ms')::integer,
    coalesce((p ->> 'rating_delta')::numeric, 0), coalesce((p ->> 'xp_total')::integer, 0)
  )
  on conflict (user_id, question_id, mode, context) do nothing
  returning id into v_answer;

  if v_answer is null then
    return jsonb_build_object('inserted', false);
  end if;

  if p ? 'rating_after' then
    update rating_state set
      rating = (p ->> 'rating_after')::numeric,
      peak = greatest(peak, (p ->> 'rating_after')::numeric),
      games = games + 1,
      combo = (p ->> 'combo_after')::integer,
      best_combo = greatest(best_combo, (p ->> 'combo_after')::integer)
    where user_id = v_user;
    update profiles set placement_done = (p ->> 'placement_done')::boolean where id = v_user;
    update questions set rating = (p ->> 'item_rating_after')::numeric where id = v_question;
  end if;

  if p ? 'streak' then
    update streaks set
      current = (p -> 'streak' ->> 'current')::integer,
      best = (p -> 'streak' ->> 'best')::integer,
      last_active = (p -> 'streak' ->> 'last_active')::date,
      shields = (p -> 'streak' ->> 'shields')::smallint
    where user_id = v_user;
  end if;

  if p ? 'srs' and p -> 'srs' <> 'null'::jsonb then
    insert into srs_cards (user_id, question_id, state, due)
    values (v_user, v_question, p -> 'srs' -> 'state', (p -> 'srs' ->> 'due')::timestamptz)
    on conflict (user_id, question_id) do update
      set state = excluded.state, due = excluded.due;
  end if;

  for v_xp in select * from jsonb_array_elements(coalesce(p -> 'xp', '[]'::jsonb)) loop
    perform award_xp(v_user, (v_xp ->> 'amount')::integer, v_xp ->> 'kind', v_xp ->> 'ref');
  end loop;

  insert into item_stats (question_id) values (v_question) on conflict do nothing;
  update item_stats set
    n = n + 1,
    correct = correct + case when v_correct then 1 else 0 end,
    option_counts[v_selected + 1] = option_counts[v_selected + 1] + 1,
    upper_n = upper_n + case when v_bucket = 'upper' then 1 else 0 end,
    upper_correct = upper_correct + case when v_bucket = 'upper' and v_correct then 1 else 0 end,
    lower_n = lower_n + case when v_bucket = 'lower' then 1 else 0 end,
    lower_correct = lower_correct + case when v_bucket = 'lower' and v_correct then 1 else 0 end,
    updated_at = now()
  where question_id = v_question;
  perform check_quarantine(v_question);

  return jsonb_build_object('inserted', true, 'answer_id', v_answer);
end $$;

-- Encerra um simulado: grava respostas sem mexer no rating, para não punir a tentativa.
create function public.finish_simulado(p jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_attempt uuid := (p ->> 'attempt_id')::uuid;
  v_user uuid := (p ->> 'user_id')::uuid;
  v_row jsonb;
  v_updated integer;
begin
  update simulado_attempts set
    finished_at = now(),
    correct = (p ->> 'correct')::integer,
    total = (p ->> 'total')::integer
  where id = v_attempt and user_id = v_user and finished_at is null;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then return false; end if;

  for v_row in select * from jsonb_array_elements(p -> 'rows') loop
    insert into answers (user_id, question_id, mode, context, selected, is_correct)
    values (
      v_user, (v_row ->> 'question_id')::uuid, 'simulado', v_attempt::text,
      (v_row ->> 'selected')::smallint, (v_row ->> 'is_correct')::boolean
    ) on conflict do nothing;

    insert into item_stats (question_id) values ((v_row ->> 'question_id')::uuid) on conflict do nothing;
    update item_stats set
      n = n + 1,
      correct = correct + case when (v_row ->> 'is_correct')::boolean then 1 else 0 end,
      option_counts[(v_row ->> 'selected')::integer + 1] = option_counts[(v_row ->> 'selected')::integer + 1] + 1,
      updated_at = now()
    where question_id = (v_row ->> 'question_id')::uuid;

    if p -> 'srs_due_rows' ? (v_row ->> 'question_id') then
      insert into srs_cards (user_id, question_id, state, due)
      values (
        v_user, (v_row ->> 'question_id')::uuid,
        p -> 'srs_due_rows' -> (v_row ->> 'question_id') -> 'state',
        (p -> 'srs_due_rows' -> (v_row ->> 'question_id') ->> 'due')::timestamptz
      ) on conflict (user_id, question_id) do nothing;
    end if;
  end loop;

  perform award_xp(v_user, (p ->> 'xp')::integer, 'simulado', v_attempt::text);
  return true;
end $$;

-- Liga da semana anterior: sobem os 5 primeiros, descem os 5 últimos (se o grupo for grande o bastante).
create function public.rollover_leagues(p_week date) returns integer
language plpgsql security definer set search_path = public as $$
declare v_count integer := 0; r record;
begin
  for r in
    select user_id, tier,
      rank() over w as pos,
      count(*) over (partition by tier, group_no) as size
    from league_members
    where week_start = p_week and outcome is null
    window w as (partition by tier, group_no order by xp desc, user_id)
  loop
    if r.size >= 10 and r.pos <= 5 then
      update league_members set outcome = 'sobe' where week_start = p_week and user_id = r.user_id;
      update profiles set league_tier = least(league_tier + 1, 6) where id = r.user_id;
    elsif r.size >= 10 and r.pos > r.size - 5 then
      update league_members set outcome = 'desce' where week_start = p_week and user_id = r.user_id;
      update profiles set league_tier = greatest(league_tier - 1, 0) where id = r.user_id;
    else
      update league_members set outcome = 'fica' where week_start = p_week and user_id = r.user_id;
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- Liga das Faculdades: média de XP por aluno ativo, com mínimo de 5 ativos,
-- para escola grande não vencer só por tamanho e nenhum aluno ficar identificável.
create function public.school_ranking(p_week date) returns table (
  school_id uuid, school_name text, uf char(2), active_members bigint, avg_xp numeric, total_xp bigint
)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.uf, count(*), round(avg(lm.xp), 1), sum(lm.xp)
  from league_members lm
  join profiles p on p.id = lm.user_id
  join schools s on s.id = p.school_id
  where lm.week_start = p_week and lm.xp > 0
  group by s.id, s.name, s.uf
  having count(*) >= 5
  order by avg(lm.xp) desc, sum(lm.xp) desc
  limit 100
$$;

-- Limite simples por janela fixa. Retorna true quando o limite foi ultrapassado.
create function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
begin
  insert into rate_limits (key, window_start, count) values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = rate_limits.count + 1
  returning count into v_count;
  if random() < 0.01 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_count > p_limit;
end $$;

-- Voto em comentário, com contagem atômica.
create function public.vote_comment(p_user uuid, p_comment uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare v_inserted integer; v_votes integer;
begin
  insert into comment_votes (comment_id, user_id) values (p_comment, p_user) on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    select votes into v_votes from comments where id = p_comment;
    return v_votes;
  end if;
  update comments set votes = votes + 1 where id = p_comment returning votes into v_votes;
  return v_votes;
end $$;

-- Só o servidor chama essas funções.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('ensure_league_member', 'award_xp', 'check_quarantine', 'apply_answer',
        'finish_simulado', 'rollover_leagues', 'school_ranking', 'rate_limit_hit', 'vote_comment')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
