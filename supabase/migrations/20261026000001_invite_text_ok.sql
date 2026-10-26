-- Texting an invitee is a separate choice from inviting them.
--
-- Twilio's toll-free review (2026-10-26, reason 30513) read "the Create button stays
-- disabled until the consent box is checked" as making SMS consent a condition of
-- using the service, which carriers forbid. So the trip is created either way, and
-- the consent box now only decides whether Zebrasplit sends the text: unticked, the
-- invite rows still exist (the join link works, the inviter shares it however they
-- like) but no message leaves this number.
alter table public.invites add column if not exists text_ok boolean not null default true;
comment on column public.invites.text_ok is 'The inviter confirmed permission to text this person. False = invite exists, no SMS is sent.';

-- only pending invites the inviter agreed to text go to the text function
create or replace function public.send_invite_text()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if new.status = 'pending' and new.text_ok then
    perform private.call_function('send-invite', jsonb_build_object('invite_id', new.id));
  end if;
  return new;
end $$;
