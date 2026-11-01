-- Lumio · Personal tutor permission tests (migration 0009)
-- One transaction, rolled back. A clean run returns 'tutor tests: all passed'.
-- Students A and B, parent P linked to A with EVERY sharing switch on — the
-- parent must still see nothing of the tutor.

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tt.a@test.lumio', '{"account_role":"student","first_name":"Ava"}', now(), now()),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tt.b@test.lumio', '{"account_role":"student","first_name":"Ben"}', now(), now()),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tt.p@test.lumio', '{"account_role":"parent","first_name":"Pat"}', now(), now());
insert into public.parent_student_links (parent_id, student_id, initiated_by, status, accepted_at, share_conversations)
values ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000a2', 'parent', 'active', now(), true);

create or replace function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- ---------------------------------------------------------------------------
-- Student A uses the tutor
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-0000000000a2');

insert into public.tutors (student_id, name, personality, teaching_style, pace, depth)
values ('00000000-0000-4000-8000-0000000000a2', 'Sage', 'patient', 'visual', 'slow', 'simple');
update public.tutors set personality = 'strict_supportive' where student_id = '00000000-0000-4000-8000-0000000000a2';

do $$ begin
  begin
    update public.tutors set name = '<script>' where student_id = '00000000-0000-4000-8000-0000000000a2';
    raise exception 'invalid tutor name accepted';
  exception when check_violation then null;
  end;
end $$;

insert into public.tutor_conversations (id, student_id, title, subject_id, topic)
values ('00000000-0000-4000-8000-00000000c0a1', '00000000-0000-4000-8000-0000000000a2', 'Osmosis',
        (select id from public.subjects where slug = 'biology'), 'Osmosis');
insert into public.tutor_messages (conversation_id, student_id, role, content)
values ('00000000-0000-4000-8000-00000000c0a1', '00000000-0000-4000-8000-0000000000a2', 'user', 'What is osmosis?');

do $$ begin
  assert (select message_count from public.tutor_conversations where id = '00000000-0000-4000-8000-00000000c0a1') = 1,
    'message count maintained by trigger';
  -- Forging a tutor reply is refused.
  begin
    insert into public.tutor_messages (conversation_id, student_id, role, content)
    values ('00000000-0000-4000-8000-00000000c0a1', '00000000-0000-4000-8000-0000000000a2', 'assistant', 'Forged');
    raise exception 'student forged an assistant message';
  exception when insufficient_privilege then null;
  end;
  -- Over-long user messages are refused.
  begin
    insert into public.tutor_messages (conversation_id, student_id, role, content)
    values ('00000000-0000-4000-8000-00000000c0a1', '00000000-0000-4000-8000-0000000000a2', 'user', repeat('x', 2001));
    raise exception 'over-long message accepted';
  exception when check_violation then null;
  end;
  -- Messages are immutable; counters aren't user-writable.
  begin
    update public.tutor_messages set content = 'edited';
    raise exception 'student edited a message';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.tutor_conversations set message_count = 0;
    raise exception 'student reset message_count';
  exception when insufficient_privilege then null;
  end;
  -- Memory is server-written only.
  begin
    perform public.service_remember('00000000-0000-4000-8000-0000000000a2', 'strength', null, 'Everything', null, 'student');
    raise exception 'student wrote memory';
  exception when insufficient_privilege then null;
  end;
  -- Quota reflects the free plan and recent messages.
  assert (public.get_tutor_quota() ->> 'planId') = 'free', 'free plan by default';
  assert (public.get_tutor_quota() ->> 'allowance')::int = 50, 'free allowance from plan data';
  assert (public.get_tutor_quota() ->> 'lastMinute')::int = 1, 'rate window counts own messages';
end $$;

update public.tutor_conversations set title = 'Osmosis in plant cells' where id = '00000000-0000-4000-8000-00000000c0a1';

-- ---------------------------------------------------------------------------
-- Server (owner role here; service role in production) writes reply, usage, memory
-- ---------------------------------------------------------------------------
reset role;
insert into public.tutor_messages (conversation_id, student_id, role, content, model)
values ('00000000-0000-4000-8000-00000000c0a1', '00000000-0000-4000-8000-0000000000a2', 'assistant',
        'Osmosis is the movement of water…', 'claude-haiku-5-5');
insert into public.usage_events (user_id, plan_id, feature, allowance, units, provider, model, input_tokens, output_tokens)
values ('00000000-0000-4000-8000-0000000000a2', 'free', 'tutor.chat', 'tutor_messages', 1, 'anthropic', 'claude-haiku-5-5', 3000, 400);
select public.service_remember('00000000-0000-4000-8000-0000000000a2', 'topic_studied',
  (select id from public.subjects where slug = 'biology'), 'Osmosis', null, 'tutor_conversation');
select public.service_remember('00000000-0000-4000-8000-0000000000a2', 'topic_studied',
  (select id from public.subjects where slug = 'biology'), 'osmosis ', null, 'tutor_conversation');

-- A message can't be attached to someone else's conversation, even by the server.
do $$ begin
  begin
    insert into public.tutor_messages (conversation_id, student_id, role, content)
    values ('00000000-0000-4000-8000-00000000c0a1', '00000000-0000-4000-8000-0000000000b2', 'assistant', 'Cross-wired');
    raise exception 'message attached to another student''s conversation';
  exception when raise_exception then
    if sqlerrm <> 'LUMIO:not_found' then raise; end if;
  end;
end $$;

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-0000000000a2');
do $$ begin
  assert (select count(*) from public.tutor_messages where conversation_id = '00000000-0000-4000-8000-00000000c0a1') = 2,
    'A sees both turns';
  assert (select occurrences from public.student_memory where lower(topic) = 'osmosis') = 2,
    'repeated topic increments one memory item, case/space-insensitively';
  assert (public.get_tutor_quota() ->> 'usedThisMonth')::numeric = 1, 'usage counted';
end $$;

-- ---------------------------------------------------------------------------
-- Student B sees and changes nothing of A's
-- ---------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-4000-8000-0000000000b2');
do $$ begin
  assert (select count(*) from public.tutors) = 0, 'B sees no tutor settings of A';
  assert (select count(*) from public.tutor_conversations) = 0, 'B sees no conversations of A';
  assert (select count(*) from public.tutor_messages) = 0, 'B sees no messages of A';
  assert (select count(*) from public.student_memory) = 0, 'B sees no memory of A';
  assert (public.get_tutor_quota() ->> 'usedThisMonth')::numeric = 0, 'B quota is own';
  -- Writing into A's conversation: as B (RLS) or as A (not B's identity).
  begin
    insert into public.tutor_messages (conversation_id, student_id, role, content)
    values ('00000000-0000-4000-8000-00000000c0a1', '00000000-0000-4000-8000-0000000000b2', 'user', 'Hi');
    raise exception 'B wrote into A''s conversation';
  exception when raise_exception then
    if sqlerrm <> 'LUMIO:not_found' then raise; end if;
  end;
  begin
    insert into public.tutor_messages (conversation_id, student_id, role, content)
    values ('00000000-0000-4000-8000-00000000c0a1', '00000000-0000-4000-8000-0000000000a2', 'user', 'Hi');
    raise exception 'B impersonated A';
  exception when insufficient_privilege then null;
  end;
  -- Silent no-ops on A's rows.
  update public.tutor_conversations set title = 'Hacked' where id = '00000000-0000-4000-8000-00000000c0a1';
  delete from public.tutor_conversations where id = '00000000-0000-4000-8000-00000000c0a1';
  delete from public.student_memory;
  update public.tutors set name = 'Hacked';
end $$;

-- ---------------------------------------------------------------------------
-- Parent P (linked to A, every sharing switch on) sees nothing
-- ---------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-4000-8000-0000000000d2');
do $$ begin
  assert (select count(*) from public.tutors) = 0, 'parent sees no tutor settings';
  assert (select count(*) from public.tutor_conversations) = 0, 'parent sees no conversations';
  assert (select count(*) from public.tutor_messages) = 0, 'parent sees no messages';
  assert (select count(*) from public.student_memory) = 0, 'parent sees no memory';
end $$;

-- Anonymous: nothing.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  begin
    perform 1 from public.tutor_messages;
    raise exception 'anon read messages';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.get_tutor_quota();
    raise exception 'anon called quota';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- A's data survived B; A can forget a memory and delete a conversation
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-0000000000a2');
do $$ begin
  assert (select title from public.tutor_conversations where id = '00000000-0000-4000-8000-00000000c0a1') = 'Osmosis in plant cells',
    'B could not rename A''s conversation';
  assert (select name from public.tutors) = 'Sage', 'B could not rename A''s tutor';
  assert (select count(*) from public.student_memory) = 1, 'B could not delete A''s memory';
end $$;
delete from public.student_memory;
delete from public.tutor_conversations where id = '00000000-0000-4000-8000-00000000c0a1';
reset role;
do $$ begin
  assert (select count(*) from public.student_memory where student_id = '00000000-0000-4000-8000-0000000000a2') = 0,
    'A can make the tutor forget';
  assert (select count(*) from public.tutor_messages where conversation_id = '00000000-0000-4000-8000-00000000c0a1') = 0,
    'deleting a conversation deletes its messages';
end $$;

-- ---------------------------------------------------------------------------
-- get_tutor_context (migration 0010): one read, own rows only
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-0000000000a2');
insert into public.tutor_conversations (id, student_id, title)
values ('00000000-0000-4000-8000-00000000c0a2', '00000000-0000-4000-8000-0000000000a2', 'Second');
insert into public.tutor_messages (conversation_id, student_id, role, content)
values ('00000000-0000-4000-8000-00000000c0a2', '00000000-0000-4000-8000-0000000000a2', 'user', 'Private question');
do $$
declare r jsonb := public.get_tutor_context('00000000-0000-4000-8000-00000000c0a2', 12);
begin
  assert r->'conversation'->>'title' = 'Second', 'A gets own conversation';
  assert jsonb_array_length(r->'history') = 1, 'A gets own history';
  assert r->'tutor'->>'name' = 'Sage', 'A gets own tutor settings';
  assert (r->'quota'->>'allowance')::int = 50, 'quota included';
end $$;

select pg_temp.act_as('00000000-0000-4000-8000-0000000000b2');
do $$
declare r jsonb := public.get_tutor_context('00000000-0000-4000-8000-00000000c0a2', 12);
begin
  assert r->'conversation' = 'null'::jsonb, 'B asking for A''s conversation gets nothing';
  assert jsonb_array_length(r->'history') = 0, 'B gets none of A''s messages';
  assert r->'tutor' = 'null'::jsonb, 'B has no tutor settings yet';
  assert jsonb_array_length(r->'memory') = 0, 'B sees none of A''s memory';
end $$;

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d2');
do $$ begin
  begin
    perform public.get_tutor_context(null, 12);
    raise exception 'parent got a tutor context';
  exception when raise_exception then
    if sqlerrm <> 'LUMIO:wrong_role' then raise; end if;
  end;
end $$;
reset role;

select 'tutor tests: all passed' as result;
rollback;
