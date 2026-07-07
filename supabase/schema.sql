create extension if not exists pgcrypto;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  team_id uuid references public.teams(id),
  full_name text,
  email text,
  role text check (role in ('admin', 'caller')) default 'caller',
  created_at timestamptz default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) not null,
  company_name text not null,
  company_form text,
  industry text,
  city text,
  phone text,
  email text,
  finder_url text,
  website_url text,
  assigned_to uuid references public.profiles(id),
  status text not null default 'new' check (
    status in (
      'new',
      'no_answer',
      'answered',
      'not_interested',
      'has_website',
      'wrong_number',
      'call_later',
      'demo_promised',
      'demo_sent',
      'follow_up_booked',
      'negotiation',
      'closed_won',
      'closed_lost',
      'archived'
    )
  ),
  priority text default 'normal',
  notes text,
  next_follow_up_at timestamptz,
  demo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.call_activities (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) not null,
  lead_id uuid references public.leads(id) on delete cascade,
  user_id uuid references public.profiles(id),
  outcome text not null check (
    outcome in (
      'no_answer',
      'answered',
      'not_interested',
      'wrong_number',
      'call_later',
      'demo_promised',
      'demo_sent',
      'follow_up_done',
      'closed_won',
      'closed_lost'
    )
  ),
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) not null,
  lead_id uuid references public.leads(id),
  closed_by uuid references public.profiles(id),
  client_name text not null,
  amount_cents integer not null,
  commission_cents integer default 0,
  payment_status text check (payment_status in ('unpaid', 'paid', 'partly_paid')) default 'unpaid',
  billing_type text check (billing_type in ('upfront', 'monthly', 'yearly', 'other')) default 'upfront',
  closed_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) not null,
  user_id uuid references public.profiles(id),
  goal_type text not null,
  target_number integer not null,
  period text check (period in ('daily', 'weekly', 'monthly')) not null,
  created_at timestamptz default now()
);

create index if not exists leads_team_id_idx on public.leads(team_id);
create index if not exists leads_assigned_to_idx on public.leads(assigned_to);
create index if not exists leads_follow_up_idx on public.leads(next_follow_up_at);
create index if not exists call_activities_team_created_idx on public.call_activities(team_id, created_at);
create index if not exists deals_team_closed_idx on public.deals(team_id, closed_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    'caller'
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.team_id is not null and auth.uid() = old.id and not public.is_team_admin(old.team_id) then
    new.role = old.role;
    new.team_id = old.team_id;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update
before update on public.profiles
for each row execute function public.guard_profile_update();

create or replace function public.current_team_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select team_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_team_admin(team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and team_id = team
      and role = 'admin'
  )
$$;

create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  code text;
begin
  loop
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.teams where invite_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public.create_team_for_current_user(team_name text default 'Mediaboost')
returns public.teams
language plpgsql
security definer
set search_path = public
as $$
declare
  new_team public.teams;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in';
  end if;

  insert into public.teams (name, invite_code, created_by)
  values (coalesce(nullif(trim(team_name), ''), 'Mediaboost'), public.generate_invite_code(), auth.uid())
  returning * into new_team;

  insert into public.profiles (id, team_id, full_name, email, role)
  values (
    auth.uid(),
    new_team.id,
    coalesce((auth.jwt()->>'user_metadata')::jsonb->>'full_name', ''),
    auth.jwt()->>'email',
    'admin'
  )
  on conflict (id) do update set
    team_id = new_team.id,
    role = 'admin',
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name);

  return new_team;
end;
$$;

create or replace function public.join_team_by_invite(invite text)
returns public.teams
language plpgsql
security definer
set search_path = public
as $$
declare
  found_team public.teams;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in';
  end if;

  select * into found_team
  from public.teams
  where invite_code = upper(trim(invite));

  if found_team.id is null then
    raise exception 'Invite code not found';
  end if;

  insert into public.profiles (id, team_id, full_name, email, role)
  values (
    auth.uid(),
    found_team.id,
    coalesce((auth.jwt()->>'user_metadata')::jsonb->>'full_name', ''),
    auth.jwt()->>'email',
    'caller'
  )
  on conflict (id) do update set
    team_id = found_team.id,
    role = case when public.profiles.role = 'admin' then 'admin' else 'caller' end,
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name);

  return found_team;
end;
$$;

alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.call_activities enable row level security;
alter table public.deals enable row level security;
alter table public.goals enable row level security;

drop policy if exists "teams_select_own" on public.teams;
create policy "teams_select_own" on public.teams
for select using (id = public.current_team_id() or created_by = auth.uid());

drop policy if exists "teams_insert_authenticated" on public.teams;
create policy "teams_insert_authenticated" on public.teams
for insert with check (auth.uid() = created_by);

drop policy if exists "teams_update_admin" on public.teams;
create policy "teams_update_admin" on public.teams
for update using (public.is_team_admin(id)) with check (public.is_team_admin(id));

drop policy if exists "profiles_select_team" on public.profiles;
create policy "profiles_select_team" on public.profiles
for select using (id = auth.uid() or team_id = public.current_team_id());

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
for insert with check (id = auth.uid() and team_id is null and role = 'caller');

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin" on public.profiles
for update using (id = auth.uid() or public.is_team_admin(team_id))
with check (id = auth.uid() or public.is_team_admin(team_id));

drop policy if exists "leads_select_team" on public.leads;
create policy "leads_select_team" on public.leads
for select using (team_id = public.current_team_id());

drop policy if exists "leads_insert_admin" on public.leads;
create policy "leads_insert_admin" on public.leads
for insert with check (team_id = public.current_team_id() and public.is_team_admin(team_id));

drop policy if exists "leads_update_team_work" on public.leads;
create policy "leads_update_team_work" on public.leads
for update using (
  team_id = public.current_team_id()
  and (public.is_team_admin(team_id) or assigned_to = auth.uid() or assigned_to is null)
) with check (
  team_id = public.current_team_id()
  and (public.is_team_admin(team_id) or assigned_to = auth.uid() or assigned_to is null)
);

drop policy if exists "leads_delete_admin" on public.leads;
create policy "leads_delete_admin" on public.leads
for delete using (team_id = public.current_team_id() and public.is_team_admin(team_id));

drop policy if exists "activities_select_team" on public.call_activities;
create policy "activities_select_team" on public.call_activities
for select using (team_id = public.current_team_id());

drop policy if exists "activities_insert_team_user" on public.call_activities;
create policy "activities_insert_team_user" on public.call_activities
for insert with check (team_id = public.current_team_id() and user_id = auth.uid());

drop policy if exists "activities_delete_admin" on public.call_activities;
create policy "activities_delete_admin" on public.call_activities
for delete using (team_id = public.current_team_id() and public.is_team_admin(team_id));

drop policy if exists "deals_select_team" on public.deals;
create policy "deals_select_team" on public.deals
for select using (team_id = public.current_team_id());

drop policy if exists "deals_insert_team_member" on public.deals;
create policy "deals_insert_team_member" on public.deals
for insert with check (team_id = public.current_team_id() and (closed_by = auth.uid() or public.is_team_admin(team_id)));

drop policy if exists "deals_update_owner_or_admin" on public.deals;
create policy "deals_update_owner_or_admin" on public.deals
for update using (team_id = public.current_team_id() and (closed_by = auth.uid() or public.is_team_admin(team_id)))
with check (team_id = public.current_team_id() and (closed_by = auth.uid() or public.is_team_admin(team_id)));

drop policy if exists "deals_delete_admin" on public.deals;
create policy "deals_delete_admin" on public.deals
for delete using (team_id = public.current_team_id() and public.is_team_admin(team_id));

drop policy if exists "goals_select_team" on public.goals;
create policy "goals_select_team" on public.goals
for select using (team_id = public.current_team_id());

drop policy if exists "goals_insert_admin" on public.goals;
create policy "goals_insert_admin" on public.goals
for insert with check (team_id = public.current_team_id() and public.is_team_admin(team_id));

drop policy if exists "goals_update_admin" on public.goals;
create policy "goals_update_admin" on public.goals
for update using (team_id = public.current_team_id() and public.is_team_admin(team_id))
with check (team_id = public.current_team_id() and public.is_team_admin(team_id));

drop policy if exists "goals_delete_admin" on public.goals;
create policy "goals_delete_admin" on public.goals
for delete using (team_id = public.current_team_id() and public.is_team_admin(team_id));
