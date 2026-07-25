// Client-side call to the send-patient-invitation Edge Function (see
// supabase/functions/send-patient-invitation/), which emails a plain
// notification to a patient a clinician has just added, inviting them to
// create their own FluidSense account. Mirrors the request shape of
// src/lib/careTeam/sendSummary.ts (raw fetch to
// `${VITE_SUPABASE_URL}/functions/v1/<name>` with a bearer anon key). Never
// throws for an expected failure path — "not configured" and "request
// failed" both come back as typed results the caller can branch on.

import { isSupabaseConfigured } from "../supabase/client";

export interface SendPatientInvitationSuccess {
  status: "ok";
}

export interface SendPatientInvitationUnavailable {
  status: "unavailable";
  message: string;
}

export interface SendPatientInvitationError {
  status: "error";
  message: string;
}

export type SendPatientInvitationResult =
  | SendPatientInvitationSuccess
  | SendPatientInvitationUnavailable
  | SendPatientInvitationError;

/**
 * POSTs an invitation request to the send-patient-invitation Edge Function.
 * Never throws for expected failure paths (unconfigured backend, network
 * failure, non-OK response) — those come back as a typed "unavailable" or
 * "error" result with a generic, non-diagnostic message.
 */
export async function sendPatientInvitation(params: {
  patientEmail: string;
  patientDisplayName: string;
  invitedByName: string;
}): Promise<SendPatientInvitationResult> {
  if (!isSupabaseConfigured()) {
    return {
      status: "unavailable",
      message: "Sending invitations is not configured.",
    };
  }

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-patient-invitation`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(params),
    });
  } catch {
    return {
      status: "error",
      message: "Could not reach the invitation service.",
    };
  }

  if (!res.ok) {
    return {
      status: "error",
      message: `Invitation service returned an error (${res.status}).`,
    };
  }

  return { status: "ok" };
}
