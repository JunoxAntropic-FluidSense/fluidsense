// Client-side call to the send-care-team-summary Edge Function (see
// supabase/functions/send-care-team-summary/, built by a parallel task),
// which emails a plain-text fluid summary to the patient's chosen care team
// contacts. Mirrors the request shape of src/lib/photo/estimateVolume.ts
// (raw fetch to `${VITE_SUPABASE_URL}/functions/v1/<name>` with a bearer
// anon key), but posts a JSON body rather than FormData per this function's
// contract. Like estimateVolume.ts, this module never throws for an
// expected failure path — "not configured" and "request failed" both come
// back as typed results the caller can branch on directly.
//
// This is only ever called after the caller has confirmed explicit patient
// consent (careTeamShareConsent) and at least one saved contact — see
// SummaryPage.tsx — but this module does not itself gate on consent; it
// just performs the send. No diagnostic/clinical content is added here:
// summaryText is passed through unchanged from the caller.

import { isSupabaseConfigured } from "../supabase/client";

export interface SendCareTeamSummarySuccess {
  status: "ok";
  sent: number;
}

export interface SendCareTeamSummaryUnavailable {
  status: "unavailable";
  message: string;
}

export interface SendCareTeamSummaryError {
  status: "error";
  message: string;
}

export type SendCareTeamSummaryResult =
  | SendCareTeamSummarySuccess
  | SendCareTeamSummaryUnavailable
  | SendCareTeamSummaryError;

/**
 * POSTs a fluid summary to the send-care-team-summary Edge Function so it can
 * be emailed to the given recipients. Never throws for expected failure
 * paths (unconfigured backend, network failure, non-OK response, malformed
 * response body) — those all come back as a typed "unavailable" or "error"
 * result with a generic, non-diagnostic message. No raw response body or
 * status detail is echoed back to the caller.
 */
export async function sendCareTeamSummary(params: {
  recipients: { name: string; email: string }[];
  patientDisplayName: string;
  summaryText: string;
}): Promise<SendCareTeamSummaryResult> {
  if (!isSupabaseConfigured()) {
    return {
      status: "unavailable",
      message: "Sending to your care team is not configured.",
    };
  }

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-care-team-summary`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        recipients: params.recipients,
        patientDisplayName: params.patientDisplayName,
        summaryText: params.summaryText,
      }),
    });
  } catch {
    return {
      status: "error",
      message: "Could not reach the care team sharing service.",
    };
  }

  if (!res.ok) {
    return {
      status: "error",
      message: `Care team sharing service returned an error (${res.status}).`,
    };
  }

  let data: { sent?: unknown };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return {
      status: "error",
      message: "Care team sharing service returned an unreadable response.",
    };
  }

  if (typeof data.sent !== "number") {
    return {
      status: "error",
      message: "Care team sharing service returned an invalid response.",
    };
  }

  return { status: "ok", sent: data.sent };
}
