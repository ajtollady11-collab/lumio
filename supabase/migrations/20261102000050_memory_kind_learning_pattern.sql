-- Lumio · 0011a · New enum values must be committed before use, so this runs on its own.
alter type public.memory_kind add value if not exists 'learning_pattern';
