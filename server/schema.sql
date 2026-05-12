create table if not exists district_scores (
  score_date date not null,
  province text not null,
  score integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (score_date, province)
);

create table if not exists catch_events (
  id bigserial primary key,
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

alter table catch_events
  add column if not exists coins integer not null default 0;

create table if not exists broadcast_events (
  id bigserial primary key,
  player_id text not null,
  province text not null,
  fish_id text not null,
  fish_name text not null,
  rarity text not null,
  created_at timestamptz not null default now()
);

create index if not exists catch_events_score_date_idx
  on catch_events (score_date);

create index if not exists catch_events_player_id_idx
  on catch_events (player_id);

create index if not exists catch_events_score_date_weight_idx
  on catch_events (score_date, weight desc);

create index if not exists broadcast_events_created_at_idx
  on broadcast_events (created_at desc);
