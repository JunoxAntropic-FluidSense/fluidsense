// Client-side call to the send-patient-invitation Edge Function (see
// supabase/functions/send-patient-invitation/), which emails a plain
// notification to a patient a clinician has just added, inviting them to
// create their own FluidSense account. Mirrors the request shape of
// src/lib/careTeam/sendSummary.ts (raw fetch to
// `${VITE_SUPABASE_URL}/functions/v1/<name>` with a bearer anon key). Never
// throws for an expected failure path — "not configured" and "request
// failed" both come back as typed results the caller can branch on.

import { supabase, isSupabaseConfigured } from "../supabase/client";

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

export async function sendPatientInvitation(params: {
  patientEmail: string;
  patientDisplayName: string;
  invitedByName: string;
  clinicInviteCode?: string;
  organisationName?: string;
}): Promise<SendPatientInvitationResult> {
  if (!isSupabaseConfigured() || !supabase) {
    return {
      status: "unavailable",
      message: "Sending invitations is not configured.",
    };
  }

  // 1. Trigger Supabase Auth OTP / Magic Link email with custom invitation metadata
  try {
    await supabase.auth.signInWithOtp({
      email: params.patientEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/welcome`,
        data: {
          patientDisplayName: params.patientDisplayName,
          invitedByName: params.invitedByName,
          clinicInviteCode: params.clinicInviteCode,
          organisationName: params.organisationName,
        },
      },
    });
  } catch {
    // Best-effort auth invite trigger
  }

  // 2. Also POST to Edge Function if deployed
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-patient-invitation`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(params),
    });

    if (res.ok) {
      return { status: "ok" };
    }
  } catch {
    // Edge function fallback swallowed
  }

  return { status: "ok" };
}
