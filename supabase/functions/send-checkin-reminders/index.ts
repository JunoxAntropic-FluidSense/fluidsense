// Supabase Edge Function: hourly check-in reminder job.
//
// For every profile, computes the patient's current local hour (via
// profiles.timezone, defaulting to UTC when unset). If that local hour is
// 5, 12, or 17 — the start of the morning/afternoon/evening check-in window
// — and no non-deleted fluid_events row exists for that profile inside the
// corresponding window on the current local calendar day, sends a plain,
// non-diagnostic reminder: a Web Push notification if the profile has a
// valid push subscription, falling back to email (via Resend) otherwise or
// if every push attempt fails.
//
// This function is intended to be called only by the `checkin-reminders-hourly`
// pg_cron job set up in supabase/migrations/0003_checkin_push.sql, never by a
// client. It is not a diagnostic tool: it only reports whether an entry has
// been recorded, never anything about the entry's contents or meaning.
//
// Deploy with:  supabase functions deploy send-checkin-reminders
//
// Secrets required (set via `supabase secrets set ...`):
//   supabase secrets set VAPID_PUBLIC_KEY=...
//   supabase secrets set VAPID_PRIVATE_KEY=...
//   supabase secrets set VAPID_SUBJECT=mailto:you@yourdomain.example
//   supabase secrets set RESEND_API_KEY=re_...
//   supabase secrets set CRON_SECRET=<a long random string, must match the
//     x-cron-secret value baked into the cron.schedule() call in
//     0003_checkin_push.sql>
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are already auto-injected into
// every Edge Function's environment by Supabase — the service-role key is
// used here (never the anon key) because this job must read across every
// profile, bypassing RLS, as an internal/trusted process.
//
// Caveat: local check-in windows are computed from each profile's IANA
// timezone using Intl.DateTimeFormat with a single UTC-offset lookup per
// window boundary. This is accurate for the common case but can be off by
// up to an hour for a profile whose timezone happens to shift its UTC
// offset (a DST transition) in the middle of a check-in window — an
// acceptable approximation for a best-effort reminder, not something this
// prototype tries to correct for.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT");

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
// Placeholder sender address — replace with a sending address on a domain
// verified in your Resend account before this goes live.
const RESEND_FROM_ADDRESS = "FluidSense <checkins@yourdomain.example>";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

type CheckinWindow = "morning" | "afternoon" | "evening";

// Local hour at which each window starts, and the hour it ends (both on the
// same local calendar day). Must match the client-side display windows
// exactly: morning 05:00-12:00, afternoon 12:00-17:00, evening 17:00-22:00.
const WINDOWS: Record<number, { window: CheckinWindow; endHour: number }> = {
  5: { window: "morning", endHour: 12 },
  12: { window: "afternoon", endHour: 17 },
  17: { window: "evening", endHour: 22 },
};

const WINDOW_MESSAGE_BODY: Record<CheckinWindow, string> = {
  morning:
    "Nothing logged yet this morning — a quick voice note takes a few seconds.",
  afternoon:
    "Nothing logged yet this afternoon — a quick voice note takes a few seconds.",
  evening:
    "Nothing logged yet this evening — a quick voice note takes a few seconds.",
};

interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface ProfileRow {
  id: string;
  owner_user_id: string;
  timezone: string | null;
  push_subscriptions: PushSubscriptionRow[] | null;
}

/** Local wall-clock date/time parts for `date` in `timeZone`. */
function getZonedParts(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Minutes to add to UTC to get local wall-clock time in `timeZone` at `date`. */
function getUtcOffsetMinutes(timeZone: string, date: Date): number {
  const zoned = getZonedParts(timeZone, date);
  const asUtcMs = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second
  );
  return (asUtcMs - date.getTime()) / 60000;
}

/**
 * Converts a local wall-clock hour on the current local calendar day (as
 * seen in `timeZone`) to the equivalent UTC instant, for building
 * fluid_events query bounds. See the DST caveat in the file header comment.
 */
function localHourToUtcMs(
  timeZone: string,
  localDate: { year: number; month: number; day: number },
  hour: number
): number {
  const guessUtcMs = Date.UTC(
    localDate.year,
    localDate.month - 1,
    localDate.day,
    hour,
    0,
    0
  );
  const offsetMinutes = getUtcOffsetMinutes(timeZone, new Date(guessUtcMs));
  return guessUtcMs - offsetMinutes * 60000;
}

interface Summary {
  pushNotified: number;
  emailNotified: number;
  skipped: number;
  errors: number;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const summary: Summary = {
    pushNotified: 0,
    emailNotified: 0,
    skipped: 0,
    errors: 0,
  };

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, owner_user_id, timezone, push_subscriptions(id, endpoint, p256dh, auth)"
    )
    .returns<ProfileRow[]>();

  if (profilesError || !profiles) {
    return new Response(
      JSON.stringify({
        error: "Could not read profiles.",
        detail: String(profilesError),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const now = new Date();

  for (const profile of profiles) {
    try {
      const timeZone = profile.timezone ?? "UTC";
      const localHourStr = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "2-digit",
        hour12: false,
      }).format(now);
      const localHour = Number.parseInt(localHourStr, 10) % 24;

      const windowInfo = WINDOWS[localHour];
      if (!windowInfo) {
        summary.skipped += 1;
        continue;
      }

      const localDateParts = getZonedParts(timeZone, now);
      const windowStartMs = localHourToUtcMs(
        timeZone,
        localDateParts,
        localHour
      );
      const windowEndMs = localHourToUtcMs(
        timeZone,
        localDateParts,
        windowInfo.endHour
      );

      const { data: existingEvents, error: eventsError } = await supabaseAdmin
        .from("fluid_events")
        .select("id")
        .eq("profile_id", profile.id)
        .eq("deleted", false)
        .gte("event_time", new Date(windowStartMs).toISOString())
        .lt("event_time", new Date(windowEndMs).toISOString())
        .limit(1);

      if (eventsError) {
        summary.errors += 1;
        continue;
      }

      if (existingEvents && existingEvents.length > 0) {
        // Already logged something in this window — no reminder needed.
        summary.skipped += 1;
        continue;
      }

      const body = WINDOW_MESSAGE_BODY[windowInfo.window];
      const payload = JSON.stringify({
        title: "FluidSense",
        body,
        url: "/voice",
      });

      let pushSucceeded = false;
      const subscriptions = profile.push_subscriptions ?? [];

      if (
        subscriptions.length > 0 &&
        VAPID_PUBLIC_KEY &&
        VAPID_PRIVATE_KEY &&
        VAPID_SUBJECT
      ) {
        for (const sub of subscriptions) {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              payload
            );
            pushSucceeded = true;
          } catch (pushError) {
            const statusCode = (pushError as { statusCode?: number })
              ?.statusCode;
            if (statusCode === 404 || statusCode === 410) {
              // Subscription is gone (browser unsubscribed, permission
              // revoked, etc.) — remove it so future runs don't retry it.
              await supabaseAdmin
                .from("push_subscriptions")
                .delete()
                .eq("id", sub.id);
            }
          }
        }
      }

      if (pushSucceeded) {
        summary.pushNotified += 1;
        continue;
      }

      // No valid push subscription, or every push attempt failed — fall
      // back to emailing the patient's account email via Resend.
      if (!RESEND_API_KEY) {
        summary.errors += 1;
        continue;
      }

      const { data: userData, error: userError } =
        await supabaseAdmin.auth.admin.getUserById(profile.owner_user_id);

      const email = userData?.user?.email;
      if (userError || !email) {
        summary.errors += 1;
        continue;
      }

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: RESEND_FROM_ADDRESS,
          to: email,
          subject: "FluidSense check-in reminder",
          text: body,
        }),
      });

      if (resendResponse.ok) {
        summary.emailNotified += 1;
      } else {
        summary.errors += 1;
      }
    } catch (_perProfileError) {
      // One profile's failure must never abort the whole batch.
      summary.errors += 1;
    }
  }

  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
