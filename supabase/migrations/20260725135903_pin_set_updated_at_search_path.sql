-- Security-advisor remediation, applied directly to the remote project via
-- the Supabase MCP tool (not originally written as a local file — this copy
-- exists so the local migrations folder matches what's actually applied).
-- Pins search_path on the updated_at trigger function so it can't be
-- hijacked by a session-level search_path change ("Function Search Path
-- Mutable" advisor warning).
create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
