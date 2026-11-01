-- Lumio · 0009a · Clients may choose a conversation's UUID, so the UI can
-- navigate to a new conversation before the first reply arrives.
grant insert (id) on public.tutor_conversations to authenticated;
