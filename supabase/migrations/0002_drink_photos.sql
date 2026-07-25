-- FluidSense drink photos: Storage bucket + fluid_events metadata columns.
-- Bucket name is `drink-photos` — treat this as the stable, canonical name;
-- client code (see src/lib/photo/storage.ts) reads photos from this bucket.
-- Run alongside 0001_init.sql via the Supabase CLI: `supabase db push`.

-- ---------------------------------------------------------------------------
-- Storage bucket: private, per-profile drink photo attachments.
-- Object paths are `<profileId>/<eventId>.jpg` (or similar), so the leading
-- path segment is always a profile id.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('drink-photos', 'drink-photos', false)
on conflict (id) do nothing;

alter table storage.objects enable row level security;

create policy "owners can manage their drink photos" on storage.objects
  for all using (
    bucket_id = 'drink-photos'
    and exists (
      select 1 from public.profiles p
      where p.id = ((storage.foldername(name))[1])::uuid
        and p.owner_user_id = auth.uid()
    )
  ) with check (
    bucket_id = 'drink-photos'
    and exists (
      select 1 from public.profiles p
      where p.id = ((storage.foldername(name))[1])::uuid
        and p.owner_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- fluid_events: nullable columns mirroring the client's photo fields
-- (FluidEvent.photoStoragePath / FluidEvent.photoSource in src/types.ts).
-- ---------------------------------------------------------------------------
alter table public.fluid_events
  add column if not exists photo_storage_path text;

alter table public.fluid_events
  add column if not exists photo_source text
    check (photo_source in ('attached', 'ai_estimate'));
