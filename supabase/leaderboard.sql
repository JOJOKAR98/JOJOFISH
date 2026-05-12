create table if not exists public.district_scores (
  score_date date not null,
  province text not null,
  score integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (score_date, province)
);

create table if not exists public.catch_events (
  id bigint generated always as identity primary key,
  score_date date not null,
  player_id text not null,
  province text not null,
  fish_id text not null,
  fish_name text not null,
  rarity text not null,
  weight numeric not null,
  score integer not null,
  coins integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.catch_events
  add column if not exists coins integer not null default 0;

create table if not exists public.broadcast_events (
  id bigint generated always as identity primary key,
  player_id text not null,
  province text not null,
  fish_id text not null,
  fish_name text not null,
  rarity text not null,
  created_at timestamptz not null default now()
);

create index if not exists broadcast_events_created_at_idx
  on public.broadcast_events (created_at desc);

create or replace function public.record_catch(
  p_score_date date,
  p_player_id text,
  p_province text,
  p_fish_id text,
  p_fish_name text,
  p_rarity text,
  p_weight numeric,
  p_score integer,
  p_coins integer default 0
) returns void
language plpgsql
security definer
as $$
begin
  insert into public.catch_events (
    score_date,
    player_id,
    province,
    fish_id,
    fish_name,
    rarity,
    weight,
    score,
    coins
  ) values (
    p_score_date,
    p_player_id,
    p_province,
    p_fish_id,
    p_fish_name,
    p_rarity,
    p_weight,
    p_score,
    greatest(0, p_coins)
  );

  insert into public.district_scores (score_date, province, score, updated_at)
  values (p_score_date, p_province, p_score, now())
  on conflict (score_date, province)
  do update set
    score = public.district_scores.score + excluded.score,
    updated_at = now();

  if p_rarity in ('legendary', 'epic', 'mutant', 'king') then
    insert into public.broadcast_events (
      player_id,
      province,
      fish_id,
      fish_name,
      rarity
    ) values (
      p_player_id,
      p_province,
      p_fish_id,
      p_fish_name,
      p_rarity
    );
  end if;
end;
$$;

alter table public.district_scores enable row level security;
alter table public.catch_events enable row level security;
alter table public.broadcast_events enable row level security;

drop policy if exists "Read district scores" on public.district_scores;
create policy "Read district scores"
on public.district_scores for select
to anon
using (true);

drop policy if exists "Insert catch events through rpc" on public.catch_events;
create policy "Insert catch events through rpc"
on public.catch_events for insert
to anon
with check (true);

drop policy if exists "Read broadcast events" on public.broadcast_events;
create policy "Read broadcast events"
on public.broadcast_events for select
to anon
using (true);

grant select on public.district_scores to anon;
grant select on public.broadcast_events to anon;
grant execute on function public.record_catch(date, text, text, text, text, text, numeric, integer, integer) to anon;
