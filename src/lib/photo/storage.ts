// Client helper for the private `drink-photos` Supabase Storage bucket
// (bucket + RLS defined in supabase/migrations/0002_drink_photos.sql).
// Reuses the existing Supabase client singleton (src/lib/supabase/client.ts)
// rather than creating a new one — see issue #0009. Follows the same
// typed-result idiom as src/lib/supabase/auth.ts and session.ts: every
// exported function checks `if (!supabase) return {...}` before calling any
// Supabase method, and normalizes SDK errors into a plain `{ message }`
// shape. Never throws, per CLAUDE.md's "backend is optional" rule — the app
// must keep working fully client-side without a configured backend.

import { supabase } from "../supabase/client";

/** Bucket name from #0007's migration (supabase/migrations/0002_drink_photos.sql). */
const DRINK_PHOTOS_BUCKET = "drink-photos";

/** Default lifetime for signed URLs handed back to the UI, in seconds. */
const DEFAULT_SIGNED_URL_EXPIRY_SECONDS = 60 * 60;

export interface NormalizedStorageError {
  message: string;
}

export interface UploadPhotoResult {
  path: string | null;
  error: NormalizedStorageError | null;
}

export interface SignedPhotoUrlResult {
  signedUrl: string | null;
  error: NormalizedStorageError | null;
}

const NOT_CONFIGURED_ERROR: NormalizedStorageError = {
  message: "Supabase is not configured.",
};

function normalizeError(
  error: { message: string } | null | undefined
): NormalizedStorageError | null {
  return error ? { message: error.message } : null;
}

/**
 * Object path convention from #0007: `<profileId>/<eventId>.jpg`. Matches
 * what FluidEvent.photoStoragePath is expected to store.
 */
export function buildPhotoStoragePath(
  profileId: string,
  eventId: string
): string {
  return `${profileId}/${eventId}.jpg`;
}

/**
 * Uploads a drink photo to the private `drink-photos` bucket at
 * `<profileId>/<eventId>.jpg`, overwriting any existing object at that path.
 * Resolves to a typed result rather than throwing — callers should check
 * `error` rather than wrapping this in try/catch.
 */
export async function uploadDrinkPhoto(
  profileId: string,
  eventId: string,
  file: Blob | File
): Promise<UploadPhotoResult> {
  if (!supabase) {
    return { path: null, error: NOT_CONFIGURED_ERROR };
  }
  const path = buildPhotoStoragePath(profileId, eventId);
  const { data, error } = await supabase.storage
    .from(DRINK_PHOTOS_BUCKET)
    .upload(path, file, { upsert: true, contentType: "image/jpeg" });
  return {
    path: data?.path ?? null,
    error: normalizeError(error),
  };
}

/**
 * Generates a time-limited signed URL for a photo already stored at `path`
 * (as returned by uploadDrinkPhoto / stored in FluidEvent.photoStoragePath).
 * The bucket is private, so a signed URL is required to display the image.
 */
export async function getDrinkPhotoSignedUrl(
  path: string,
  expiresInSeconds: number = DEFAULT_SIGNED_URL_EXPIRY_SECONDS
): Promise<SignedPhotoUrlResult> {
  if (!supabase) {
    return { signedUrl: null, error: NOT_CONFIGURED_ERROR };
  }
  const { data, error } = await supabase.storage
    .from(DRINK_PHOTOS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  return {
    signedUrl: data?.signedUrl ?? null,
    error: normalizeError(error),
  };
}
