// Supabase Edge Function: lets an authenticated patient manually send their
// already-built fluid summary text to one or more named care-team email
// contacts, via Resend.
//
// Deploy with:  supabase functions deploy send-care-team-summary
//
// Reuses the RESEND_API_KEY secret already set for send-checkin-reminders —
// no new secret needs to be configured for this function.
//
// This function is called directly by the patient's own authenticated
// client (not by a cron job), so unlike send-checkin-reminders it does not
// check an x-cron-secret header. Supabase's platform-level JWT verification
// (the default for every deployed function, unmodified in this repo's
// config.toml) already requires a valid Authorization bearer token — anon
// key or user JWT — before this function runs at all, the same way
// transcribe and estimate-volume are already callable from the client with
// just the anon key.
//
// This is not a diagnostic tool: it only relays the summary text the client
// already built and the patient chose to share, unedited, to contacts the
// patient added themselves. It never generates, interprets, or embellishes
// that text.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

// Placeholder sender address — replace with a sending address on a domain
// verified in your Resend account before this goes live.
const RESEND_FROM_ADDRESS = "FluidSense <checkins@yourdomain.example>";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_RECIPIENTS = 10;
const MAX_SUMMARY_LENGTH = 5000;
// Simple shape check, not a full RFC validator — good enough to catch
// obviously malformed input before we attempt a send.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Recipient {
  name: string;
  email: string;
}

interface RequestBody {
  recipients: Recipient[];
  patientDisplayName: string;
  summaryText: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidRecipient(value: unknown): value is Recipient {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    isNonEmptyString(candidate.name) &&
    isNonEmptyString(candidate.email) &&
    EMAIL_SHAPE.test(candidate.email.trim())
  );
}

function parseAndValidateBody(raw: unknown): RequestBody | null {
  if (typeof raw !== "object" || raw === null) return null;
  const candidate = raw as Record<string, unknown>;

  const { recipients, patientDisplayName, summaryText } = candidate;

  if (!Array.isArray(recipients)) return null;
  if (recipients.length === 0 || recipients.length > MAX_RECIPIENTS) {
    return null;
  }
  if (!recipients.every(isValidRecipient)) return null;

  if (!isNonEmptyString(patientDisplayName)) return null;

  if (!isNonEmptyString(summaryText)) return null;
  if (summaryText.length > MAX_SUMMARY_LENGTH) return null;

  return {
    recipients: recipients as Recipient[],
    patientDisplayName,
    summaryText,
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
        error: "Care team sharing is not configured on the server.",
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

  const { recipients, patientDisplayName, summaryText } = body;
  const subject = `Fluid summary shared by ${patientDisplayName}`;
  const html = `<pre style="font-family: inherit; white-space: pre-wrap;">${escapeHtml(
    summaryText
  )}</pre>`;

  let sent = 0;
  for (const recipient of recipients) {
    try {
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: RESEND_FROM_ADDRESS,
          to: recipient.email,
          subject,
          text: summaryText,
          html,
        }),
      });

      if (resendResponse.ok) {
        sent += 1;
      }
    } catch (_perRecipientError) {
      // One bad address or one failed send must never abort the batch —
      // just skip counting it as sent.
    }
  }

  return new Response(JSON.stringify({ sent }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
