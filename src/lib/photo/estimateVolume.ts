// Client-side call to the estimate-volume Edge Function (see
// supabase/functions/estimate-volume/, defined by issue #0010), which returns
// a rough fill estimate for a drink-container photo. Mirrors the request
// shape of src/lib/voice/transcribe.ts (raw fetch to
// `${VITE_SUPABASE_URL}/functions/v1/<name>` with a bearer anon key and a
// FormData body), but unlike transcribe.ts this module never throws for an
// expected failure path — there is no browser-side fallback estimator to
// fall through to, so "not configured" and "request failed" are both
// returned as typed results the caller can branch on directly.
//
// Response typing matches #0010's closed schema exactly
// (`{ estimatedMl: number, visibleFillFraction?: number, containerGuess?: string }`)
// — no free-text/diagnostic field is read from or exposed in the response,
// per CLAUDE.md's rule against diagnostic language and #0010's schema.

import { isSupabaseConfigured } from "../supabase/client";

export interface EstimateVolumeSuccess {
  status: "ok";
  estimatedMl: number;
  visibleFillFraction?: number;
  containerGuess?: string;
}

export interface EstimateVolumeUnavailable {
  status: "unavailable";
  message: string;
}

export interface EstimateVolumeError {
  status: "error";
  message: string;
}

export type EstimateVolumeResult =
  EstimateVolumeSuccess | EstimateVolumeUnavailable | EstimateVolumeError;

/**
 * POSTs a (already compressed) photo Blob to the estimate-volume Edge
 * Function and returns a typed result. Never throws for expected failure
 * paths (unconfigured backend, network failure, non-OK response, malformed
 * response body) — those all come back as a typed "unavailable" or "error"
 * result with a generic, non-diagnostic message. No raw response body or
 * status detail is echoed back to the caller.
 */
export async function estimateVolume(
  image: Blob
): Promise<EstimateVolumeResult> {
  if (!isSupabaseConfigured()) {
    return {
      status: "unavailable",
      message: "Photo volume estimation is not configured.",
    };
  }

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/estimate-volume`;
  const form = new FormData();
  form.append("image", image, "photo.jpg");

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: form,
    });
  } catch {
    return {
      status: "error",
      message: "Could not reach the volume estimation service.",
    };
  }

  if (!res.ok) {
    return {
      status: "error",
      message: `Volume estimation service returned an error (${res.status}).`,
    };
  }

  let data: {
    estimatedMl?: unknown;
    visibleFillFraction?: unknown;
    containerGuess?: unknown;
  };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return {
      status: "error",
      message: "Volume estimation service returned an unreadable response.",
    };
  }

  if (typeof data.estimatedMl !== "number") {
    return {
      status: "error",
      message: "Volume estimation service returned an invalid response.",
    };
  }

  const result: EstimateVolumeSuccess = {
    status: "ok",
    estimatedMl: data.estimatedMl,
  };
  if (typeof data.visibleFillFraction === "number") {
    result.visibleFillFraction = data.visibleFillFraction;
  }
  if (typeof data.containerGuess === "string") {
    result.containerGuess = data.containerGuess;
  }
  return result;
}
