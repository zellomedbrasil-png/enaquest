-- Mascote e lojinha. O XP gasto fica separado do XP ganho:
-- xp_total continua valendo para o nível e a liga, e o saldo é xp_total - xp_spent.

alter table rating_state
  add column xp_spent integer not null default 0,
  add constraint xp_spent_range check (xp_spent >= 0 and xp_spent <= xp_total);

-- O que cada pessoa comprou. O catálogo (nomes e preços) mora no código.
create table mascot_items (
  user_id uuid not null references profiles (id) on delete cascade,
  item_id text not null,
  price integer not null check (price > 0),
  bought_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- O mascote escolhido, o que ele veste e o nome dado a ele.
create table mascot_state (
  user_id uuid primary key references profiles (id) on delete cascade,
  character text not null default 'doc',
  equipped jsonb not null default '{}'::jsonb,
  name text not null default 'Doc' check (char_length(name) between 2 and 16),
  updated_at timestamptz not null default now()
);

alter table mascot_items enable row level security;
alter table mascot_state enable row level security;

-- Leitura só do que é da própria pessoa; nenhuma escrita pelo navegador.
create policy own_row on mascot_items for select to authenticated using (user_id = auth.uid());
create policy own_row on mascot_state for select to authenticated using (user_id = auth.uid());

-- Compra atômica: confere o saldo e debita na mesma transação, com a linha travada,
-- para duas compras ao mesmo tempo não gastarem o mesmo XP.
create function public.buy_mascot_item(p_user uuid, p_item text, p_price integer) returns text
language plpgsql security definer set search_path = public as $$
declare v_total integer; v_spent integer;
begin
  if p_price is null or p_price <= 0 or p_item is null or p_item = '' then return 'invalid'; end if;
  select xp_total, xp_spent into v_total, v_spent from rating_state where user_id = p_user for update;
  if not found then return 'invalid'; end if;
  if exists (select 1 from mascot_items where user_id = p_user and item_id = p_item) then return 'owned'; end if;
  if v_total - v_spent < p_price then return 'insufficient'; end if;
  insert into mascot_items (user_id, item_id, price) values (p_user, p_item, p_price);
  update rating_state set xp_spent = xp_spent + p_price where user_id = p_user;
  return 'ok';
end $$;

revoke all on function public.buy_mascot_item(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.buy_mascot_item(uuid, text, integer) to service_role;
