-- Rankings. Só expõem apelido e, quando o aluno autorizou, a faculdade.

create function public.daily_leaderboard(p_day text, p_total integer) returns table (
  user_id uuid, nickname text, school text, correct bigint, total_ms bigint
)
language sql stable security definer set search_path = public as $$
  select a.user_id, p.nickname,
    case when p.show_school then s.name end,
    count(*) filter (where a.is_correct),
    coalesce(sum(a.ms), 0)
  from answers a
  join profiles p on p.id = a.user_id
  left join schools s on s.id = p.school_id
  where a.mode = 'daily' and a.context = p_day
  group by a.user_id, p.nickname, p.show_school, s.name
  having count(*) >= p_total
  order by 4 desc, 5 asc
$$;

create function public.league_table(p_week date, p_tier smallint, p_group integer) returns table (
  user_id uuid, nickname text, xp integer
)
language sql stable security definer set search_path = public as $$
  select lm.user_id, p.nickname, lm.xp
  from league_members lm join profiles p on p.id = lm.user_id
  where lm.week_start = p_week and lm.tier = p_tier and lm.group_no = p_group
  order by lm.xp desc, lm.user_id
$$;

create function public.simulado_leaderboard(p_simulado uuid) returns table (
  user_id uuid, nickname text, school text, correct integer, total integer
)
language sql stable security definer set search_path = public as $$
  select sa.user_id, p.nickname, case when p.show_school then s.name end, sa.correct, sa.total
  from simulado_attempts sa
  join profiles p on p.id = sa.user_id
  left join schools s on s.id = p.school_id
  where sa.simulado_id = p_simulado and sa.finished_at is not null
  order by sa.correct desc, sa.finished_at asc
$$;

create function public.group_table(p_group uuid, p_week date) returns table (
  user_id uuid, nickname text, xp integer
)
language sql stable security definer set search_path = public as $$
  select gm.user_id, p.nickname, coalesce(lm.xp, 0)
  from group_members gm
  join profiles p on p.id = gm.user_id
  left join league_members lm on lm.user_id = gm.user_id and lm.week_start = p_week
  where gm.group_id = p_group
  order by 3 desc, gm.user_id
$$;

revoke all on function public.daily_leaderboard(text, integer) from public, anon, authenticated;
revoke all on function public.league_table(date, smallint, integer) from public, anon, authenticated;
revoke all on function public.simulado_leaderboard(uuid) from public, anon, authenticated;
revoke all on function public.group_table(uuid, date) from public, anon, authenticated;
revoke all on function public.week_start_br(timestamptz) from public, anon, authenticated;
grant execute on function public.daily_leaderboard(text, integer) to service_role;
grant execute on function public.league_table(date, smallint, integer) to service_role;
grant execute on function public.simulado_leaderboard(uuid) to service_role;
grant execute on function public.group_table(uuid, date) to service_role;
grant execute on function public.week_start_br(timestamptz) to service_role;
