// Supabase Edge Function: sends a one-off invitation email to a patient
// when a clinician/nurse adds them in the Dashboard. Plain notification
// email only — it does not create an account, generate a login token, or
// link the recipient to the specific patient record. The patient still
// signs up (or signs in) through the normal onboarding flow; nothing here
// grants access to any data.
//
// Deploy with:  supabase functions deploy send-patient-invitation
//
// Reuses the RESEND_API_KEY secret already set for send-checkin-reminders
// and send-care-team-summary — no new secret needs to be configured.
//
// Called directly by the inviting clinician's own authenticated client, the
// same way send-care-team-summary is called by a patient's client — relies
// on Supabase's platform-level JWT verification rather than a cron secret.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const APP_URL = Deno.env.get("APP_URL") ?? "https://fluidsense.example";

// Placeholder sender address — replace with a sending address on a domain
// verified in your Resend account before this goes live.
const RESEND_FROM_ADDRESS = "FluidSense <checkins@yourdomain.example>";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_NAME_LENGTH = 200;
// Simple shape check, not a full RFC validator — good enough to catch
// obviously malformed input before we attempt a send.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RequestBody {
  patientEmail: string;
  patientDisplayName: string;
  invitedByName: string;
}

function isNonEmptyString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= MAX_NAME_LENGTH
  );
}

function parseAndValidateBody(raw: unknown): RequestBody | null {
  if (typeof raw !== "object" || raw === null) return null;
  const candidate = raw as Record<string, unknown>;

  const { patientEmail, patientDisplayName, invitedByName } = candidate;

  if (
    typeof patientEmail !== "string" ||
    !EMAIL_SHAPE.test(patientEmail.trim())
  ) {
    return null;
  }
  if (!isNonEmptyString(patientDisplayName)) return null;
  if (!isNonEmptyString(invitedByName)) return null;

  return {
    patientEmail: patientEmail.trim(),
    patientDisplayName,
    invitedByName,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!RESEND_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "Patient invitations are not configured on the server.",
      }),
      {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch (_parseError) {
    return new Response(JSON.stringify({ error: "Invalid request." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = parseAndValidateBody(raw);
  if (!body) {
    return new Response(JSON.stringify({ error: "Invalid request." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { patientEmail, patientDisplayName, invitedByName } = body;
  const subject = `${invitedByName} has invited you to FluidSense`;
  const text = `Hi ${patientDisplayName},

${invitedByName} has added you to FluidSense, a fluid intake and output tracker, so your care team can see what you record.

To get started, open FluidSense and create your account:
${APP_URL}/welcome

This is a one-off invitation email — it doesn't sign you in automatically or share any data on its own. Nothing is tracked until you record it yourself.`;
  const html = `<p>Hi ${escapeHtml(patientDisplayName)},</p>
<p>${escapeHtml(invitedByName)} has added you to FluidSense, a fluid intake and output tracker, so your care team can see what you record.</p>
<p>To get started, open FluidSense and create your account:</p>
<p><a href="${APP_URL}/welcome">${APP_URL}/welcome</a></p>
<p style="color:#666;font-size:13px;">This is a one-off invitation email — it doesn't sign you in automatically or share any data on its own. Nothing is tracked until you record it yourself.</p>`;

  try {
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_ADDRESS,
        to: patientEmail,
        subject,
        text,
        html,
      }),
    });

    if (!resendResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Couldn't send the invitation email." }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (_sendError) {
    return new Response(
      JSON.stringify({ error: "Couldn't reach the email service." }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(JSON.stringify({ sent: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
