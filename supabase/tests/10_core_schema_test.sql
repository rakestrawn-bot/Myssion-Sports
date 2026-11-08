-- Tests for the core schema. Each check raises an error (and stops the run)
-- if the database behaves differently from what the spec requires.

\set ON_ERROR_STOP on
set client_min_messages = warning;

-- Helpers -------------------------------------------------------------

create or replace function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), false);
  if p_user is null then
    execute 'set role anon';
  else
    execute 'set role authenticated';
  end if;
end $$;

create or replace function pg_temp.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then
    raise exception 'FAILED: %', p_msg;
  end if;
  raise notice 'ok - %', p_msg;
end $$;

grant execute on function pg_temp.login(uuid), pg_temp.ok(boolean, text) to anon, authenticated;
set client_min_messages = notice;

-- Test users ----------------------------------------------------------
--   nick  = platform owner
--   alice = staff at Sunny Isles (org 1)
--   bob   = staff at Rival League (org 2)
--   carl  = coach at Sunny Isles (not staff)

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'nick@example.test'),
  ('00000000-0000-0000-0000-0000000000a1', 'alice@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'bob@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'carl@example.test');

insert into public.platform_owners (user_id) values ('00000000-0000-0000-0000-00000000000a');

-- Organization setup through the app's own function -------------------

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select public.create_organization('Sunny Isles Beach Recreation', 'sunny-isles', 'Florida Youth Soccer Association') as org1 \gset
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select public.create_organization('Rival League', 'rival-league') as org2 \gset
reset role;

insert into public.org_members (org_id, user_id, role)
values (:'org1', '00000000-0000-0000-0000-0000000000c1', 'coach');

select pg_temp.login(null);
do $$ begin
  perform public.create_organization('Sneaky', 'sneaky');
  raise exception 'FAILED: anonymous visitor created an organization';
exception when insufficient_privilege or raise_exception then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - anonymous visitors cannot create organizations';
end $$;
reset role;

-- Build a soccer field the way spec section 5 describes ---------------
-- One full-size field with four zones A-D and three layouts:
--   Full size         : 11v11 claims A B C D
--   Two 7v7           : North claims A B, South claims C D
--   One 7v7 + two 4v4 : 7v7 claims A B, 4v4 East claims C, 4v4 West claims D

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');

insert into public.venues (org_id, name) values (:'org1', 'Gwen Margolis Park') returning id as venue1 \gset
insert into public.fields (org_id, venue_id, name) values (:'org1', :'venue1', 'Field 1') returning id as field1 \gset

insert into public.zones (org_id, field_id, name) values (:'org1', :'field1', 'A') returning id as za \gset
insert into public.zones (org_id, field_id, name) values (:'org1', :'field1', 'B') returning id as zb \gset
insert into public.zones (org_id, field_id, name) values (:'org1', :'field1', 'C') returning id as zc \gset
insert into public.zones (org_id, field_id, name) values (:'org1', :'field1', 'D') returning id as zd \gset

insert into public.field_layouts (org_id, field_id, name) values (:'org1', :'field1', 'Full size') returning id as lay_full \gset
insert into public.field_layouts (org_id, field_id, name) values (:'org1', :'field1', 'Two 7v7') returning id as lay_two7 \gset
insert into public.field_layouts (org_id, field_id, name) values (:'org1', :'field1', 'One 7v7 + two 4v4') returning id as lay_mix \gset

insert into public.layout_fields (org_id, layout_id, field_id, name, format) values (:'org1', :'lay_full', :'field1', 'Full', '11v11') returning id as lf_full \gset
insert into public.layout_fields (org_id, layout_id, field_id, name, format) values (:'org1', :'lay_two7', :'field1', '7v7 North', '7v7') returning id as lf_north \gset
insert into public.layout_fields (org_id, layout_id, field_id, name, format) values (:'org1', :'lay_two7', :'field1', '7v7 South', '7v7') returning id as lf_south \gset
insert into public.layout_fields (org_id, layout_id, field_id, name, format) values (:'org1', :'lay_mix', :'field1', '7v7', '7v7') returning id as lf_mix7 \gset
insert into public.layout_fields (org_id, layout_id, field_id, name, format) values (:'org1', :'lay_mix', :'field1', '4v4 East', '4v4') returning id as lf_east \gset
insert into public.layout_fields (org_id, layout_id, field_id, name, format) values (:'org1', :'lay_mix', :'field1', '4v4 West', '4v4') returning id as lf_west \gset

insert into public.layout_field_zones (org_id, layout_field_id, zone_id, field_id) values
  (:'org1', :'lf_full',  :'za', :'field1'), (:'org1', :'lf_full',  :'zb', :'field1'),
  (:'org1', :'lf_full',  :'zc', :'field1'), (:'org1', :'lf_full',  :'zd', :'field1'),
  (:'org1', :'lf_north', :'za', :'field1'), (:'org1', :'lf_north', :'zb', :'field1'),
  (:'org1', :'lf_south', :'zc', :'field1'), (:'org1', :'lf_south', :'zd', :'field1'),
  (:'org1', :'lf_mix7',  :'za', :'field1'), (:'org1', :'lf_mix7',  :'zb', :'field1'),
  (:'org1', :'lf_east',  :'zc', :'field1'),
  (:'org1', :'lf_west',  :'zd', :'field1');

insert into public.field_availability (org_id, field_id, day_of_week, start_time, end_time)
values (:'org1', :'field1', 6, '08:00', '14:00');

-- Saturday 9:00-10:00: 7v7 North is booked.
insert into public.bookings (org_id, layout_field_id, starts_at, ends_at, label)
values (:'org1', :'lf_north', '2027-01-09 09:00-05', '2027-01-09 10:00-05', 'U10 game') returning id as bk_north \gset

-- Make the ids above readable inside DO blocks (psql variables are not).
select set_config('my.org1', :'org1', false), set_config('my.org2', :'org2', false),
       set_config('my.venue1', :'venue1', false), set_config('my.field1', :'field1', false),
       set_config('my.lf_north', :'lf_north', false);

-- Zone conflict rule --------------------------------------------------

select pg_temp.ok(
  (select count(*) from public.booking_conflicts(:'lf_south', '2027-01-09 09:00-05', '2027-01-09 10:00-05')) = 0,
  '7v7 South can run beside 7v7 North (different zones)');

select pg_temp.ok(
  (select count(distinct booking_id) from public.booking_conflicts(:'lf_full', '2027-01-09 09:30-05', '2027-01-09 11:00-05')) = 1,
  'full-size game collides with 7v7 North (shares zones A and B)');

select pg_temp.ok(
  (select count(*) from public.booking_conflicts(:'lf_mix7', '2027-01-09 09:00-05', '2027-01-09 10:00-05')) = 2,
  'the other layout''s 7v7 collides with 7v7 North on both zones A and B');

select pg_temp.ok(
  (select count(*) from public.booking_conflicts(:'lf_east', '2027-01-09 09:00-05', '2027-01-09 10:00-05')) = 0
  and (select count(*) from public.booking_conflicts(:'lf_west', '2027-01-09 09:00-05', '2027-01-09 10:00-05')) = 0,
  'both 4v4 fields fit beside 7v7 North');

select pg_temp.ok(
  (select count(*) from public.booking_conflicts(:'lf_full', '2027-01-09 10:00-05', '2027-01-09 11:00-05')) = 0,
  'a game starting exactly when another ends is not a conflict');

select pg_temp.ok(
  (select count(*) from public.booking_conflicts(:'lf_north', '2027-01-09 09:00-05', '2027-01-09 10:00-05', :'bk_north')) = 0,
  'moving a booking does not conflict with itself');

-- Tenant separation ---------------------------------------------------

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');

select pg_temp.ok((select count(*) from public.organizations) = 1, 'Rival League staff see only their own organization');
select pg_temp.ok((select count(*) from public.venues) = 0, 'Rival League staff cannot see Sunny Isles venues');
select pg_temp.ok((select count(*) from public.bookings) = 0, 'Rival League staff cannot see Sunny Isles bookings');
select pg_temp.ok((select count(*) from public.layout_field_zones) = 0, 'Rival League staff cannot see Sunny Isles zone layouts');

do $$ begin
  insert into public.venues (org_id, name)
  values (current_setting('my.org1')::uuid, 'Hijack');
  raise exception 'FAILED: inserted into another organization';
exception when insufficient_privilege then
  raise notice 'ok - Rival League staff cannot add venues to another organization';
end $$;

update public.venues set name = 'Defaced' where true;
reset role;
select pg_temp.ok((select name from public.venues where id = :'venue1') = 'Gwen Margolis Park',
  'Rival League staff cannot rename Sunny Isles venues');

-- Rival League staff build their own venue, then try to attach a field to
-- the Sunny Isles venue by its id while labelling it as their own org.
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
insert into public.venues (org_id, name) values (:'org2', 'Rival Park') returning id as venue2 \gset
do $$ begin
  insert into public.fields (org_id, venue_id, name)
  values (current_setting('my.org2')::uuid, current_setting('my.venue1')::uuid, 'Sneaky field');
  raise exception 'FAILED: attached a field to another organization''s venue';
exception when foreign_key_violation then
  raise notice 'ok - a field cannot be attached to another organization''s venue';
end $$;
reset role;

-- A layout cannot claim a zone from a different physical field.
insert into public.fields (org_id, venue_id, name) values (:'org1', :'venue1', 'Field 2') returning id as field2 \gset
insert into public.zones (org_id, field_id, name) values (:'org1', :'field2', 'A') returning id as f2_za \gset
select set_config('my.f2_za', :'f2_za', false);
do $$ begin
  insert into public.layout_field_zones (org_id, layout_field_id, zone_id, field_id)
  values (current_setting('my.org1')::uuid, current_setting('my.lf_north')::uuid,
          current_setting('my.f2_za')::uuid, current_setting('my.field1')::uuid);
  raise exception 'FAILED: child field claimed a zone on another field';
exception when foreign_key_violation then
  raise notice 'ok - a child field can only claim zones of its own parent field';
end $$;

-- Access levels -------------------------------------------------------

select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select pg_temp.ok((select count(*) from public.organizations) = 1, 'a coach can see their organization');
select pg_temp.ok((select count(*) from public.venues) = 0, 'a coach has no staff access in phase 1');

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.ok((select count(*) from public.organizations) = 2, 'the platform owner sees every organization');
select pg_temp.ok((select count(*) from public.venues) = 2, 'the platform owner sees every organization''s venues');

select pg_temp.login(null);
-- Locally anon has no table access at all (an error); on Supabase it has
-- access but no policy (zero rows). Either way it must see nothing.
do $$
declare n bigint;
begin
  select count(*) into n from public.venues;
  if n > 0 then raise exception 'FAILED: anonymous visitor read venues'; end if;
  raise notice 'ok - anonymous visitors cannot read venues';
exception when insufficient_privilege then
  raise notice 'ok - anonymous visitors cannot read venues';
end $$;
reset role;

-- Basic data checks ---------------------------------------------------

do $$ begin
  insert into public.bookings (org_id, layout_field_id, starts_at, ends_at)
  values (current_setting('my.org1')::uuid, current_setting('my.lf_north')::uuid,
          '2027-01-09 10:00-05', '2027-01-09 09:00-05');
  raise exception 'FAILED: booking that ends before it starts was accepted';
exception when check_violation then
  raise notice 'ok - a booking must end after it starts';
end $$;

\warn 'All core schema tests passed.'
