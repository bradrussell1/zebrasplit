-- An invitee can now turn an invite down (next migration). The enum value has to land in
-- its own transaction before anything uses it.
alter type public.invite_status add value if not exists 'declined';
