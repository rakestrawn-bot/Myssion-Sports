-- =====================================================================
-- Core schema: organizations, access, venues, fields, zones, layouts,
-- availability, and bookings (spec sections 2, 3 and 5).
--
-- Tenant safety, in two layers:
--   1. Every table carries org_id, and child rows reference their parent
--      by (org_id, id). The database itself refuses to attach a row from
--      one organization to a parent in another.
--   2. Row-level security: a signed-in user only sees and changes rows of
--      organizations where they are staff (or everything, if they are the
--      platform owner).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Organizations and access levels (spec section 3)
-- ---------------------------------------------------------------------

create table public.organizations (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(trim(name)) > 0),
  slug           text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  governing_body text,               -- e.g. 'Florida Youth Soccer Association'
  created_at     timestamptz not null default now()
);

-- Tier 1: platform owner(s), across every organization.
create table public.platform_owners (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Tiers 2-4 inside one organization. Phase 1 uses only 'staff';
-- club_admin and coach get their own scoped rules in phase 2.
create type public.org_role as enum ('staff', 'club_admin', 'coach');

create table public.org_members (
  org_id     uuid not null references public.organizations (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.org_role not null,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index org_members_user_idx on public.org_members (user_id);

-- Helper checks used by the security policies. SECURITY DEFINER so they
-- can read the membership tables without recursing through their policies.
create function public.is_platform_owner()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.platform_owners where user_id = auth.uid());
$$;

create function public.is_org_staff(p_org_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_platform_owner()
      or exists (
           select 1 from public.org_members
           where org_id = p_org_id and user_id = auth.uid() and role = 'staff'
         );
$$;

create function public.is_org_member(p_org_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_platform_owner()
      or exists (
           select 1 from public.org_members
           where org_id = p_org_id and user_id = auth.uid()
         );
$$;

-- Creates an organization and makes the caller its first staff member
-- (step 1 of the first-run setup, spec section 4).
create function public.create_organization(p_name text, p_slug text, p_governing_body text default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create an organization';
  end if;

  insert into public.organizations (name, slug, governing_body)
  values (p_name, p_slug, p_governing_body)
  returning id into v_org_id;

  insert into public.org_members (org_id, user_id, role)
  values (v_org_id, auth.uid(), 'staff');

  return v_org_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Venues, fields, zones and layouts (spec section 5)
--
--   venue ─┬─ field (the physical parent field)
--          │    ├─ zone           physical pieces of the field ("A", "B"…)
--          │    └─ layout         a named way to split it ("Two 7v7")
--          │         └─ layout_field   a playable child field ("7v7 North")
--          │              └─ claims one or more zones of the same field
-- ---------------------------------------------------------------------

create table public.venues (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  name       text not null check (length(trim(name)) > 0),
  address    text,
  created_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, name)
);

create table public.fields (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null,
  venue_id   uuid not null,
  name       text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (org_id, id),
  unique (venue_id, name),
  foreign key (org_id, venue_id) references public.venues (org_id, id) on delete cascade
);

create table public.zones (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null,
  field_id   uuid not null,
  name       text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (org_id, id),
  unique (id, field_id),
  unique (field_id, name),
  foreign key (org_id, field_id) references public.fields (org_id, id) on delete cascade
);

create table public.field_layouts (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null,
  field_id   uuid not null,
  name       text not null check (length(trim(name)) > 0),   -- e.g. 'Full size', 'Two 7v7'
  created_at timestamptz not null default now(),
  unique (org_id, id),
  unique (id, field_id),
  unique (field_id, name),
  foreign key (org_id, field_id) references public.fields (org_id, id) on delete cascade
);

create table public.layout_fields (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null,
  layout_id  uuid not null,
  field_id   uuid not null,          -- copied from the layout so zone claims can be checked
  name       text not null check (length(trim(name)) > 0),   -- e.g. '7v7 North'
  format     text,                                           -- e.g. '7v7', '4v4', '11v11'
  created_at timestamptz not null default now(),
  unique (org_id, id),
  unique (id, field_id),
  unique (layout_id, name),
  foreign key (org_id, layout_id) references public.field_layouts (org_id, id) on delete cascade,
  foreign key (layout_id, field_id) references public.field_layouts (id, field_id) on delete cascade
);

-- Which zones each child field occupies. The two composite keys force the
-- zone and the child field to sit on the same parent field.
create table public.layout_field_zones (
  org_id          uuid not null references public.organizations (id) on delete cascade,
  layout_field_id uuid not null,
  zone_id         uuid not null,
  field_id        uuid not null,
  primary key (layout_field_id, zone_id),
  foreign key (layout_field_id, field_id) references public.layout_fields (id, field_id) on delete cascade,
  foreign key (zone_id, field_id) references public.zones (id, field_id) on delete cascade,
  foreign key (org_id, layout_field_id) references public.layout_fields (org_id, id) on delete cascade
);

create index layout_field_zones_zone_idx on public.layout_field_zones (zone_id);

-- Weekly availability windows. A row with layout_field_id set applies to
-- that child field only and replaces the parent field's windows for it.
create table public.field_availability (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null,
  field_id        uuid not null,
  layout_field_id uuid,
  day_of_week     smallint not null check (day_of_week between 0 and 6),  -- 0 = Sunday
  start_time      time not null,
  end_time        time not null,
  effective_from  date,
  effective_to    date,
  created_at      timestamptz not null default now(),
  check (start_time < end_time),
  check (effective_from is null or effective_to is null or effective_from <= effective_to),
  foreign key (org_id, field_id) references public.fields (org_id, id) on delete cascade,
  foreign key (layout_field_id, field_id) references public.layout_fields (id, field_id) on delete cascade
);

create index field_availability_field_idx on public.field_availability (field_id);

-- ---------------------------------------------------------------------
-- Bookings and the zone conflict rule (spec section 5)
--
-- Two bookings collide only if they claim the same zone at the same time.
-- Games will reference bookings once the scheduling engine is built.
-- ---------------------------------------------------------------------

create table public.bookings (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null,
  layout_field_id uuid not null,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  label           text,
  created_at      timestamptz not null default now(),
  check (starts_at < ends_at),
  unique (org_id, id),
  foreign key (org_id, layout_field_id) references public.layout_fields (org_id, id) on delete cascade
);

create index bookings_time_idx on public.bookings using gist (tstzrange(starts_at, ends_at));
create index bookings_layout_field_idx on public.bookings (layout_field_id);

-- Lists the existing bookings that would collide with a proposed booking.
-- An empty result means the slot is free. Runs with the caller's
-- permissions, so it only ever looks at the caller's own organization.
create function public.booking_conflicts(
  p_layout_field_id    uuid,
  p_starts_at          timestamptz,
  p_ends_at            timestamptz,
  p_exclude_booking_id uuid default null
)
returns table (booking_id uuid, layout_field_id uuid, zone_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql stable security invoker set search_path = public
as $$
  select b.id, b.layout_field_id, theirs.zone_id, b.starts_at, b.ends_at
  from public.layout_field_zones mine
  join public.layout_field_zones theirs on theirs.zone_id = mine.zone_id
  join public.bookings b on b.layout_field_id = theirs.layout_field_id
  where mine.layout_field_id = p_layout_field_id
    and tstzrange(b.starts_at, b.ends_at) && tstzrange(p_starts_at, p_ends_at)
    and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
  order by b.starts_at, b.id, theirs.zone_id;
$$;

-- ---------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------

alter table public.organizations      enable row level security;
alter table public.platform_owners    enable row level security;
alter table public.org_members        enable row level security;
alter table public.venues             enable row level security;
alter table public.fields             enable row level security;
alter table public.zones              enable row level security;
alter table public.field_layouts      enable row level security;
alter table public.layout_fields      enable row level security;
alter table public.layout_field_zones enable row level security;
alter table public.field_availability enable row level security;
alter table public.bookings           enable row level security;

-- Organizations: members can see theirs; staff can rename/edit theirs.
-- New organizations are created only through create_organization().
create policy org_select on public.organizations for select to authenticated
  using (public.is_org_member(id));
create policy org_update on public.organizations for update to authenticated
  using (public.is_org_staff(id)) with check (public.is_org_staff(id));
create policy org_delete on public.organizations for delete to authenticated
  using (public.is_platform_owner());

-- Platform owners: only visible to platform owners; managed directly in the database.
create policy platform_owners_select on public.platform_owners for select to authenticated
  using (public.is_platform_owner());

-- Members: you can see your own memberships; staff manage their organization's.
create policy org_members_select on public.org_members for select to authenticated
  using (user_id = auth.uid() or public.is_org_staff(org_id));
create policy org_members_write on public.org_members for all to authenticated
  using (public.is_org_staff(org_id)) with check (public.is_org_staff(org_id));

-- Venue-side tables: phase 1 is staff-only, so staff get full access to
-- their own organization's rows and nobody else sees anything.
create policy venues_staff on public.venues for all to authenticated
  using (public.is_org_staff(org_id)) with check (public.is_org_staff(org_id));
create policy fields_staff on public.fields for all to authenticated
  using (public.is_org_staff(org_id)) with check (public.is_org_staff(org_id));
create policy zones_staff on public.zones for all to authenticated
  using (public.is_org_staff(org_id)) with check (public.is_org_staff(org_id));
create policy field_layouts_staff on public.field_layouts for all to authenticated
  using (public.is_org_staff(org_id)) with check (public.is_org_staff(org_id));
create policy layout_fields_staff on public.layout_fields for all to authenticated
  using (public.is_org_staff(org_id)) with check (public.is_org_staff(org_id));
create policy layout_field_zones_staff on public.layout_field_zones for all to authenticated
  using (public.is_org_staff(org_id)) with check (public.is_org_staff(org_id));
create policy field_availability_staff on public.field_availability for all to authenticated
  using (public.is_org_staff(org_id)) with check (public.is_org_staff(org_id));
create policy bookings_staff on public.bookings for all to authenticated
  using (public.is_org_staff(org_id)) with check (public.is_org_staff(org_id));

-- Table privileges (row-level security above still filters every row).
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.platform_owners from authenticated;
revoke insert on public.organizations from authenticated;
grant execute on function public.create_organization(text, text, text) to authenticated;
grant execute on function public.booking_conflicts(uuid, timestamptz, timestamptz, uuid) to authenticated;
revoke all on function public.create_organization(text, text, text) from anon, public;
