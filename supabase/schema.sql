-- Sailo · Supabase schema (run once in the SQL editor of project dfytxscebupuqwehsojc)
-- Idempotent: safe to re-run.

create extension if not exists citext;

-- ── Profiles ──────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext unique,
  display_name text check (char_length(display_name) between 1 and 40),
  avatar_url text,
  bio text check (char_length(bio) <= 160),
  onboarding_completed boolean not null default false,
  starting_region jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username is null or username ~ '^[A-Za-z0-9._]{3,20}$')
);

create table if not exists public.reserved_usernames (name citext primary key);
insert into public.reserved_usernames(name) values
 ('admin'),('administrator'),('sailo'),('sailoapp'),('support'),('help'),('root'),('system'),('moderator'),('mod'),
 ('staff'),('official'),('owner'),('api'),('www'),('null'),('undefined'),('security'),('team'),('captain'),('harbourmaster'),('everyone')
on conflict do nothing;

create or replace function public.profiles_before_write() returns trigger language plpgsql as $$
begin
  if new.username is not null and exists (select 1 from public.reserved_usernames r where r.name = new.username) then
    raise exception 'username_reserved' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    new.id := old.id;            -- ids are immutable
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists profiles_before_write on public.profiles;
create trigger profiles_before_write before insert or update on public.profiles
  for each row execute function public.profiles_before_write();

-- ── Boats ─────────────────────────────────────────────────────────────────
create table if not exists public.boat_catalog (
  id text primary key, name text not null, hull text not null, color text not null,
  rarity text not null, req_kind text not null check (req_kind in ('start','streak','voyages')), req_value int not null default 0
);
insert into public.boat_catalog values
 ('drifter','The Drifter','drifter','#c89b6a','Common','start',0),
 ('harbour','Harbour Sloop','sloop','#ff7a59','Common','streak',2),
 ('tide','Tide Runner','sloop','#5fd4c4','Common','streak',3),
 ('saltmarsh','Saltmarsh','launch','#9fd27a','Common','voyages',3),
 ('lantern','Lantern Brig','launch','#f2c14e','Rare','streak',4),
 ('reedling','Reedling','drifter','#9fd27a','Common','voyages',5),
 ('moonwake','Moonwake','sloop','#c9b6ff','Rare','streak',5),
 ('coral','Coral Skiff','drifter','#ff9fb0','Rare','streak',6),
 ('drift','Drift Queen','cat','#efe8da','Epic','streak',7),
 ('kelpie','Kelpie','launch','#3fb88a','Rare','voyages',8),
 ('lagoon','Lagoon Punt','drifter','#3fb8c8','Rare','streak',9),
 ('pelican','Pelican','sloop','#f2c14e','Rare','streak',10),
 ('seaglass','Seaglass','sloop','#a8e6e0','Rare','voyages',12),
 ('nightjar','Nightjar','launch','#6a7fc0','Epic','streak',14),
 ('mistral','Mistral','launch','#e9e4ff','Epic','voyages',15),
 ('monsoon','Monsoon','launch','#4a7fb0','Epic','streak',18),
 ('saffron','Saffron','sloop','#f0a23b','Epic','voyages',20),
 ('albatross','Albatross','sloop','#f6f1e7','Epic','streak',21),
 ('ember','Ember Galleon','cat','#e8604c','Epic','voyages',25),
 ('sovereign','Sovereign','cat','#e0b44a','Legendary','streak',30),
 ('kraken','Kraken','cat','#3d5a80','Legendary','voyages',40),
 ('aurora','Aurora','launch','#8fe3b0','Legendary','streak',45),
 ('tempest','Tempest','cat','#6a6f7a','Legendary','voyages',60),
 ('leviathan','Leviathan','cat','#1f3b4d','Legendary','streak',60)
on conflict (id) do update set name=excluded.name, hull=excluded.hull, color=excluded.color, rarity=excluded.rarity, req_kind=excluded.req_kind, req_value=excluded.req_value;

create table if not exists public.user_boats (
  user_id uuid not null references auth.users(id) on delete cascade,
  boat_id text not null references public.boat_catalog(id),
  unlocked_at timestamptz not null default now(),
  active boolean not null default false,
  primary key (user_id, boat_id)
);
create unique index if not exists user_boats_one_active on public.user_boats(user_id) where active;

create table if not exists public.user_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  streak int not null default 0, best int not null default 0, last_day date,
  voyages int not null default 0, updated_at timestamptz not null default now()
);

-- Map position, destination, customisation, privacy + social cache (owner-only)
create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ── Row Level Security ────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.boat_catalog enable row level security;
alter table public.user_boats enable row level security;
alter table public.user_streaks enable row level security;
alter table public.user_state enable row level security;
alter table public.reserved_usernames enable row level security;

drop policy if exists "profiles readable by signed-in users" on public.profiles;
create policy "profiles readable by signed-in users" on public.profiles for select to authenticated using (true);
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "catalog is public" on public.boat_catalog;
create policy "catalog is public" on public.boat_catalog for select to anon, authenticated using (true);

drop policy if exists "own boats" on public.user_boats;
create policy "own boats" on public.user_boats for select to authenticated using (user_id = auth.uid());
drop policy if exists "own streak" on public.user_streaks;
create policy "own streak" on public.user_streaks for select to authenticated using (user_id = auth.uid());

drop policy if exists "own state read" on public.user_state;
create policy "own state read" on public.user_state for select to authenticated using (user_id = auth.uid());
drop policy if exists "own state insert" on public.user_state;
create policy "own state insert" on public.user_state for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "own state update" on public.user_state;
create policy "own state update" on public.user_state for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- user_boats / user_streaks have no write policies: they change only through the security-definer RPCs below.

-- ── New-user setup (idempotent) ───────────────────────────────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare want citext := nullif(new.raw_user_meta_data->>'username','');
begin
  if want is not null and (want !~ '^[A-Za-z0-9._]{3,20}$'
     or exists (select 1 from profiles where username = want)
     or exists (select 1 from reserved_usernames where name = want)) then
    want := null;  -- never block signup; onboarding asks again
  end if;
  insert into profiles(id, username, display_name)
    values (new.id, want, left(coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), 40))
    on conflict (id) do nothing;
  insert into user_boats(user_id, boat_id, active) values (new.id, 'drifter', true) on conflict do nothing;
  insert into user_streaks(user_id) values (new.id) on conflict do nothing;
  insert into user_state(user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ── RPCs ──────────────────────────────────────────────────────────────────
create or replace function public.username_available(candidate text) returns boolean
language sql stable security definer set search_path = public as $$
  select candidate ~ '^[A-Za-z0-9._]{3,20}$'
     and not exists (select 1 from reserved_usernames r where r.name = candidate::citext)
     and not exists (select 1 from profiles p where p.username = candidate::citext and p.id is distinct from auth.uid());
$$;
grant execute on function public.username_available(text) to anon, authenticated;

create or replace function public.get_fleet() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'streak', coalesce(s.streak,0), 'best', coalesce(s.best,0), 'last_day', s.last_day, 'voyages', coalesce(s.voyages,0),
    'owned', coalesce((select json_agg(boat_id order by unlocked_at) from user_boats where user_id = auth.uid()), '[]'::json),
    'active', (select boat_id from user_boats where user_id = auth.uid() and active limit 1))
  from (select auth.uid() as uid) u left join user_streaks s on s.user_id = u.uid;
$$;
grant execute on function public.get_fleet() to authenticated;

-- A finished voyage is the qualifying activity for streaks. Server date, server rules.
create or replace function public.record_voyage(tz text default 'UTC') returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s user_streaks; today date;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from pg_timezone_names where name = tz) then tz := 'UTC'; end if;
  today := (now() at time zone tz)::date;
  insert into user_streaks(user_id) values (uid) on conflict do nothing;
  select * into s from user_streaks where user_id = uid for update;
  if s.updated_at > now() - interval '20 seconds' and s.voyages > 0 then return get_fleet(); end if; -- anti-spam
  if s.last_day is distinct from today then
    s.streak := case when s.last_day = today - 1 then s.streak + 1 else 1 end;
    s.last_day := today;
  end if;
  s.voyages := s.voyages + 1; s.best := greatest(s.best, s.streak);
  update user_streaks set streak = s.streak, best = s.best, last_day = s.last_day, voyages = s.voyages, updated_at = now() where user_id = uid;
  insert into user_boats(user_id, boat_id)
    select uid, c.id from boat_catalog c
    where c.req_kind = 'start' or (c.req_kind = 'streak' and s.best >= c.req_value) or (c.req_kind = 'voyages' and s.voyages >= c.req_value)
  on conflict do nothing;
  return get_fleet();
end $$;
grant execute on function public.record_voyage(text) to authenticated;

create or replace function public.equip_boat(boat text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from user_boats where user_id = uid and boat_id = boat) then raise exception 'not_owned'; end if;
  update user_boats set active = false where user_id = uid and active and boat_id <> boat;
  update user_boats set active = true where user_id = uid and boat_id = boat;
end $$;
grant execute on function public.equip_boat(text) to authenticated;

-- ── Avatar storage ────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars','avatars', true, 1048576, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "avatar read" on storage.objects;
create policy "avatar read" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "avatar write own folder" on storage.objects;
create policy "avatar write own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatar update own folder" on storage.objects;
create policy "avatar update own folder" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatar delete own folder" on storage.objects;
create policy "avatar delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── Messages in bottles ───────────────────────────────────────────────────
-- Short public notes that drift past other sailors. Hidden after 3 reports.
create table if not exists public.bottles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text not null default 'A sailor',
  body text not null check (char_length(btrim(body)) between 1 and 280),
  reports int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists bottles_created_idx on public.bottles(created_at desc);
create table if not exists public.bottle_reports (
  bottle_id uuid not null references public.bottles(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (bottle_id, user_id)
);
alter table public.bottles enable row level security;
alter table public.bottle_reports enable row level security;

-- Author name comes from the profile, never the client; one bottle per 5 minutes.
create or replace function public.bottles_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  new.reports := 0;
  new.created_at := now();
  new.author_name := coalesce((select left(display_name, 40) from profiles where id = new.user_id), 'A sailor');
  if exists (select 1 from bottles where user_id = new.user_id and created_at > now() - interval '5 minutes') then
    raise exception 'bottle_rate_limited' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists bottles_before_insert on public.bottles;
create trigger bottles_before_insert before insert on public.bottles for each row execute function public.bottles_before_insert();

create or replace function public.bottle_reported() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update bottles set reports = reports + 1 where id = new.bottle_id;
  return new;
end $$;
drop trigger if exists bottle_reported on public.bottle_reports;
create trigger bottle_reported after insert on public.bottle_reports for each row execute function public.bottle_reported();

drop policy if exists "bottles readable" on public.bottles;
create policy "bottles readable" on public.bottles for select to authenticated using (reports < 3 or user_id = auth.uid());
drop policy if exists "throw own bottle" on public.bottles;
create policy "throw own bottle" on public.bottles for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "delete own bottle" on public.bottles;
create policy "delete own bottle" on public.bottles for delete to authenticated using (user_id = auth.uid());
drop policy if exists "report once" on public.bottle_reports;
create policy "report once" on public.bottle_reports for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "own reports" on public.bottle_reports;
create policy "own reports" on public.bottle_reports for select to authenticated using (user_id = auth.uid());

-- A few random bottles written by other sailors.
create or replace function public.random_bottles(n int default 5) returns setof public.bottles
language sql volatile security invoker set search_path = public as $$
  select * from bottles where user_id <> auth.uid() and reports < 3
  order by random() limit least(greatest(n, 1), 20);
$$;
revoke execute on function public.random_bottles(int) from anon, public;
grant execute on function public.random_bottles(int) to authenticated;
-- Trigger functions are not meant to be called over the API.
revoke execute on function public.bottles_before_insert() from anon, authenticated, public;
revoke execute on function public.bottle_reported() from anon, authenticated, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- ── Ocean discoveries: debris, shipwrecks and seabed finds ───────────────
-- Object ids are generated identically on every client (from global map cells), so
-- all sailors share them. Rewards are picked here, never by the client.
create table if not exists public.ocean_catalog (
  kind text primary key,
  rarity text not null,
  rewards text[] not null,
  exclusive boolean not null default false
);
create table if not exists public.ocean_finds (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  object_id text not null,
  kind text not null references public.ocean_catalog(kind),
  rarity text not null,
  region text,
  reward text,
  created_at timestamptz not null default now(),
  primary key (user_id, object_id)
);
create index if not exists ocean_finds_recent on public.ocean_finds(user_id, created_at desc);
-- One claim per exclusive object (treasure chests): first sailor wins.
create table if not exists public.ocean_claims (
  object_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  claimed_at timestamptz not null default now()
);
alter table public.ocean_catalog enable row level security;
alter table public.ocean_finds enable row level security;
alter table public.ocean_claims enable row level security;
drop policy if exists "catalog readable" on public.ocean_catalog;
create policy "catalog readable" on public.ocean_catalog for select to anon, authenticated using (true);
drop policy if exists "own finds" on public.ocean_finds;
create policy "own finds" on public.ocean_finds for select to authenticated using (user_id = auth.uid());
drop policy if exists "claims visible" on public.ocean_claims;
create policy "claims visible" on public.ocean_claims for select to authenticated using (true);
-- No insert/update policies: finds and claims are written only by claim_find().

insert into public.ocean_catalog(kind, rarity, rewards, exclusive) values
('crate','Common',array['mat:timber','mat:nails','mat:canvas','decor:bell','decor:lantern','flag:seaglass'],false),
('barrel','Common',array['mat:timber','mat:rope','decor:lantern','mat:nails'],false),
('driftwood','Common',array['mat:timber','mat:nails'],false),
('planks','Common',array['mat:timber','mat:nails'],false),
('net','Common',array['mat:rope','mat:canvas'],false),
('rope','Common',array['mat:rope','mat:canvas'],false),
('fbuoy','Common',array['mat:rope','mat:timber','mat:canvas'],false),
('lifebuoy','Uncommon',array['mat:rope','mat:timber','mat:canvas'],false),
('suitcase','Uncommon',array['decor:compassrose','decor:bell','flag:sunset'],false),
('mast','Uncommon',array['mat:timber','mat:nails'],false),
('cargo','Rare',array['mat:nails','decor:compassrose','sail:seafoam'],false),
('dinghy','Rare',array['mat:rope','mat:timber','mat:canvas'],false),
('lantern','Rare',array['decor:lantern','flag:sunset'],false),
('chest','Very rare',array['flag:jolly','flag:aurora','sail:saffron','sail:midnight','sail:rose','flag:sunset'],true),
('bottle','Uncommon',array['mat:rope','mat:timber','mat:canvas'],false),
('w_row','Uncommon',array['relic:compass','relic:bell','mat:timber','sail:seafoam'],false),
('w_fish','Rare',array['relic:compass','relic:bell','mat:timber','sail:seafoam'],false),
('w_sail','Rare',array['relic:compass','relic:bell','mat:timber','sail:seafoam'],false),
('w_yacht','Very rare',array['relic:compass','relic:bell','mat:timber','sail:seafoam'],false),
('w_pirate','Very rare',array['relic:coin','flag:jolly','relic:compass'],false),
('w_cargo','Very rare',array['relic:compass','relic:bell','mat:timber','sail:seafoam'],false),
('w_viking','Very rare',array['relic:coin','relic:amphora','relic:figurehead','relic:compass'],false),
('w_sub','Legendary',array['relic:coin','relic:amphora','relic:figurehead','relic:compass'],false),
('w_merchant','Legendary',array['relic:coin','relic:amphora','relic:figurehead','relic:compass'],false),
('w_giant','Legendary',array['relic:coin','relic:amphora','relic:figurehead','relic:compass'],false),
('u_anchor','Uncommon',array['relic:coin','relic:amphora','relic:figurehead','relic:compass'],false),
('u_chain','Common',array['mat:rope','mat:timber','mat:canvas'],false),
('u_cannon','Rare',array['relic:coin','flag:jolly','relic:compass'],false),
('u_prop','Rare',array['mat:rope','mat:timber','mat:canvas'],false),
('u_wheel','Uncommon',array['relic:coin','relic:amphora','relic:figurehead','relic:compass'],false),
('u_pots','Common',array['relic:coin','relic:amphora','relic:figurehead','relic:compass'],false),
('u_amphora','Uncommon',array['relic:coin','relic:amphora','relic:figurehead','relic:compass'],false),
('u_chest','Very rare',array['flag:jolly','flag:aurora','sail:saffron','sail:midnight','sail:rose','flag:sunset'],true),
('u_statue','Very rare',array['relic:coin','relic:amphora','relic:figurehead','relic:compass'],false),
('u_plane','Legendary',array['relic:coin','relic:amphora','relic:figurehead','relic:compass'],false),
('u_nav','Rare',array['relic:coin','relic:amphora','relic:figurehead','relic:compass'],false),
('u_ruins','Legendary',array['relic:coin','relic:amphora','relic:figurehead','relic:compass'],false)
on conflict (kind) do update set rarity = excluded.rarity, rewards = excluded.rewards, exclusive = excluded.exclusive;

create or replace function public.claim_find(p_object text, p_kind text, p_region text default null) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cat ocean_catalog; prev text; rw text; owner uuid; n int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_object !~ '^[a-z_]+:[A-Za-z0-9_:.-]{1,80}$' or split_part(p_object, ':', 1) <> p_kind then raise exception 'bad_object'; end if;
  select * into cat from ocean_catalog where kind = p_kind;
  if not found then raise exception 'unknown_kind'; end if;
  select reward into prev from ocean_finds where user_id = uid and object_id = p_object;
  if found then return json_build_object('status', 'already', 'reward', prev); end if;
  select count(*) into n from ocean_finds where user_id = uid and created_at > now() - interval '1 hour';
  if n >= 40 then raise exception 'rate_limited'; end if;
  if cat.exclusive then
    select count(*) into n from ocean_claims where user_id = uid and claimed_at > now() - interval '1 day';
    if n >= 3 then raise exception 'rate_limited'; end if;
    insert into ocean_claims(object_id, user_id) values (p_object, uid) on conflict (object_id) do nothing;
    select user_id into owner from ocean_claims where object_id = p_object;
    if owner is distinct from uid then return json_build_object('status', 'taken'); end if;
  end if;
  rw := cat.rewards[1 + (abs(hashtext(p_object || uid::text)) % array_length(cat.rewards, 1))];
  insert into ocean_finds(user_id, object_id, kind, rarity, region, reward)
    values (uid, p_object, p_kind, cat.rarity, left(coalesce(p_region, ''), 80), rw)
    on conflict (user_id, object_id) do nothing;
  if not found then
    select reward into prev from ocean_finds where user_id = uid and object_id = p_object;
    return json_build_object('status', 'already', 'reward', prev);
  end if;
  return json_build_object('status', 'new', 'reward', rw);
end $$;
revoke execute on function public.claim_find(text, text, text) from anon, public;
grant execute on function public.claim_find(text, text, text) to authenticated;

-- Live updates when someone opens a shared treasure chest.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ocean_claims') then
    alter publication supabase_realtime add table public.ocean_claims;
  end if;
end $$;
