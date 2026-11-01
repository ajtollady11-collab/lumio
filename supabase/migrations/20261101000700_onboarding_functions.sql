-- Lumio · 0007 · Onboarding and invitation functions (see 0006 for the design notes)

-- Shared helpers ------------------------------------------------------------
create or replace function private.normalise_invite_code(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  -- Crockford base32: case-insensitive; O→0, I/L→1; separators ignored.
  select translate(upper(regexp_replace(coalesce(raw, ''), '[^A-Za-z0-9]', '', 'g')), 'OIL', '011');
$$;

create or replace function private.hash_invite_code(code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(code, 'sha256'), 'hex');
$$;

create or replace function private.require_role(expected public.account_role)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'LUMIO:not_signed_in' using errcode = 'P0001';
  end if;
  if (select role from public.profiles where id = uid) is distinct from expected then
    raise exception 'LUMIO:wrong_role' using errcode = 'P0001';
  end if;
  return uid;
end;
$$;

-- Brute-force guard: at most 10 failed code attempts per user per hour.
create or replace function private.invite_attempts_exceeded(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) >= 10 from public.audit_logs
  where actor_id = uid and action = 'invitation.failed_attempt'
    and created_at > now() - interval '1 hour';
$$;

-- Looks up an invitation. Returns a status instead of raising so that a
-- failed attempt is recorded (a raise would roll the record back and defeat
-- the rate limit).
create or replace function private.find_open_invitation(
  uid uuid, raw_code text, lock_row boolean,
  out status text, out invitation public.parent_invitations)
language plpgsql
security definer
set search_path = ''
as $$
declare
  code text := private.normalise_invite_code(raw_code);
  inv public.parent_invitations;
begin
  if private.invite_attempts_exceeded(uid) then
    status := 'rate_limited';
    return;
  end if;

  if char_length(code) <> 12 then
    insert into public.audit_logs (actor_id, action) values (uid, 'invitation.failed_attempt');
    status := 'invalid_code';
    return;
  end if;

  if lock_row then
    select * into inv from public.parent_invitations p where p.code_hash = private.hash_invite_code(code) for update;
  else
    select * into inv from public.parent_invitations p where p.code_hash = private.hash_invite_code(code);
  end if;

  if inv.id is null or inv.status = 'revoked' then
    insert into public.audit_logs (actor_id, action) values (uid, 'invitation.failed_attempt');
    status := 'invalid_code';
  elsif inv.status = 'accepted' then
    status := 'code_used';
  elsif inv.expires_at <= now() then
    status := 'code_expired';
  else
    status := 'ok';
    invitation := inv;
  end if;
end;
$$;

-- Public API (called as RPC by signed-in users) -----------------------------

create or replace function public.create_parent_invitation()
returns table (invitation_id uuid, code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_role('parent');
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';  -- Crockford base32
  raw bytea;
  plain text := '';
  i int;
  new_id uuid;
  new_expiry timestamptz := now() + interval '7 days';
begin
  if (select count(*) from public.parent_invitations p
      where p.parent_id = uid and p.status = 'pending' and p.expires_at > now()) >= 5 then
    raise exception 'LUMIO:too_many_invitations' using errcode = 'P0001';
  end if;

  raw := extensions.gen_random_bytes(12);
  for i in 0..11 loop
    -- 256 is a multiple of 32, so byte % 32 is unbiased.
    plain := plain || substr(alphabet, (get_byte(raw, i) % 32) + 1, 1);
  end loop;

  insert into public.parent_invitations (parent_id, code_hash, expires_at)
  values (uid, private.hash_invite_code(plain), new_expiry)
  returning id into new_id;

  insert into public.audit_logs (actor_id, action, target_table, target_id)
  values (uid, 'invitation.created', 'parent_invitations', new_id::text);

  return query select new_id, substr(plain, 1, 4) || '-' || substr(plain, 5, 4) || '-' || substr(plain, 9, 4), new_expiry;
end;
$$;

-- Lets a student see who an invitation is from before approving it.
-- status: ok | invalid_code | code_expired | code_used | rate_limited
create or replace function public.preview_parent_invitation(p_code text)
returns table (status text, parent_first_name text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_role('student');
  lookup record;
  found_status text;
  inv public.parent_invitations;
begin
  select * into lookup from private.find_open_invitation(uid, p_code, false);
  found_status := lookup.status;
  inv := lookup.invitation;

  if found_status <> 'ok' then
    return query select found_status, null::text, null::timestamptz;
    return;
  end if;

  if exists (select 1 from public.parent_student_links l
             where l.parent_id = inv.parent_id and l.student_id = uid and l.status = 'active') then
    return query select 'already_linked'::text, null::text, null::timestamptz;
    return;
  end if;

  return query
    select 'ok'::text, coalesce(pp.first_name, 'A parent'), inv.expires_at
    from public.parent_profiles pp where pp.profile_id = inv.parent_id;
end;
$$;

-- status: ok | invalid_code | code_expired | code_used | rate_limited | already_linked
create or replace function public.accept_parent_invitation(p_code text)
returns table (status text, link_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_role('student');
  lookup record;
  found_status text;
  inv public.parent_invitations;
  existing public.parent_student_links;
  new_link uuid;
begin
  select * into lookup from private.find_open_invitation(uid, p_code, true);
  found_status := lookup.status;
  inv := lookup.invitation;

  if found_status <> 'ok' then
    return query select found_status, null::uuid;
    return;
  end if;

  select * into existing from public.parent_student_links l
  where l.parent_id = inv.parent_id and l.student_id = uid;

  if existing.id is not null and existing.status = 'active' then
    return query select 'already_linked'::text, existing.id;
    return;
  end if;

  if existing.id is not null then
    update public.parent_student_links l
       set status = 'active', accepted_at = now(), revoked_at = null, initiated_by = 'parent',
           share_activity = true, share_results = true, share_conversations = false
     where l.id = existing.id
    returning l.id into new_link;
  else
    insert into public.parent_student_links (parent_id, student_id, status, initiated_by, accepted_at)
    values (inv.parent_id, uid, 'active', 'parent', now())
    returning id into new_link;
  end if;

  update public.parent_invitations p
     set status = 'accepted', accepted_by = uid, accepted_at = now()
   where p.id = inv.id;

  -- A linked parent account accepted by the child is the consent record for under-13s.
  update public.student_profiles sp
     set parental_consent = 'granted'
   where sp.profile_id = uid and sp.age_band = 'under_13' and sp.parental_consent = 'pending';

  insert into public.audit_logs (actor_id, action, target_table, target_id, metadata)
  values (uid, 'link.accepted', 'parent_student_links', new_link::text,
          jsonb_build_object('invitation_id', inv.id, 'parent_id', inv.parent_id));

  return query select 'ok'::text, new_link;
end;
$$;

create or replace function public.revoke_parent_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_role('parent');
begin
  update public.parent_invitations
     set status = 'revoked', revoked_at = now()
   where id = p_invitation_id and parent_id = uid and status = 'pending';
  if not found then
    raise exception 'LUMIO:not_found' using errcode = 'P0001';
  end if;
  insert into public.audit_logs (actor_id, action, target_table, target_id)
  values (uid, 'invitation.revoked', 'parent_invitations', p_invitation_id::text);
end;
$$;

-- Either side may end a link.
create or replace function public.unlink_parent_student(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'LUMIO:not_signed_in' using errcode = 'P0001';
  end if;
  update public.parent_student_links
     set status = 'revoked', revoked_at = now()
   where id = p_link_id and status = 'active' and (parent_id = uid or student_id = uid);
  if not found then
    raise exception 'LUMIO:not_found' using errcode = 'P0001';
  end if;
  insert into public.audit_logs (actor_id, action, target_table, target_id)
  values (uid, 'link.revoked', 'parent_student_links', p_link_id::text);
end;
$$;

-- Completion: the only way onboarding_completed_at is ever set.
create or replace function public.complete_student_onboarding()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_role('student');
  sp public.student_profiles;
begin
  select * into sp from public.student_profiles where profile_id = uid;
  if sp.first_name is null or sp.age_band is null or sp.school_year is null or sp.education_level is null then
    raise exception 'LUMIO:incomplete:about' using errcode = 'P0001';
  end if;
  if sp.primary_qualification_id is null then
    raise exception 'LUMIO:incomplete:qualification' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.student_subjects where student_id = uid) then
    raise exception 'LUMIO:incomplete:subjects' using errcode = 'P0001';
  end if;
  if cardinality(sp.learning_preferences) = 0 then
    raise exception 'LUMIO:incomplete:preferences' using errcode = 'P0001';
  end if;

  update public.student_profiles set onboarding_step = 8 where profile_id = uid;
  update public.profiles
     set onboarding_completed_at = coalesce(onboarding_completed_at, now())
   where id = uid;
end;
$$;

create or replace function public.complete_parent_onboarding()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_role('parent');
begin
  if (select first_name from public.parent_profiles where profile_id = uid) is null then
    raise exception 'LUMIO:incomplete:about' using errcode = 'P0001';
  end if;
  update public.profiles
     set onboarding_completed_at = coalesce(onboarding_completed_at, now())
   where id = uid;
end;
$$;

-- Execution rights: signed-in users only; helpers stay private.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.create_parent_invitation()',
    'public.preview_parent_invitation(text)',
    'public.accept_parent_invitation(text)',
    'public.revoke_parent_invitation(uuid)',
    'public.unlink_parent_student(uuid)',
    'public.complete_student_onboarding()',
    'public.complete_parent_onboarding()'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;

  foreach fn in array array[
    'private.normalise_invite_code(text)',
    'private.hash_invite_code(text)',
    'private.require_role(public.account_role)',
    'private.invite_attempts_exceeded(uuid)',
    'private.find_open_invitation(uuid, text, boolean)',
    'private.grade_is_valid(uuid, text)',
    'private.sync_display_name()',
    'private.track_parental_consent()',
    'private.validate_student_subject()',
    'private.limit_examination_dates()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
  end loop;
end;
$$;

-- grade_is_valid runs inside a trigger invoked by authenticated users.
grant execute on function private.grade_is_valid(uuid, text) to authenticated;
