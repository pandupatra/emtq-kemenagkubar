begin;

alter table public.people
  add column if not exists participant_number text
  check (char_length(participant_number) <= 250);

notify pgrst, 'reload schema';

commit;
