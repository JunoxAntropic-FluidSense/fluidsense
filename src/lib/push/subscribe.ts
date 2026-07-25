// Browser-side push subscribe/unsubscribe flow for check-in reminder
// notifications (morning/afternoon/evening). Reuses the existing Supabase
// client singleton (src/lib/supabase/client.ts) rather than creating a
// second one. Follows the same typed-result idiom as
// src/lib/photo/storage.ts / src/lib/voice/transcribe.ts's
// SERVER_STT_CONFIGURED pattern: every exported function checks for
// preconditions up front and returns a typed result rather than throwing,
// since backend + push support are both optional per CLAUDE.md — the app
// must keep working without either.
//
// The actual push payload (title/body/url) is produced server-side by a
// cron Edge Function (owned by a parallel task) — nothing here decides what
// the notification says.

import { supabase, isSupabaseConfigured } from "../supabase/client";

const PUSH_SUBSCRIPTIONS_TABLE = "push_subscriptions";
const SERVICE_WORKER_URL = "/service-worker.js";

export interface PushActionResult {
  ok: boolean;
  /** Generic, non-diagnostic explanation for the UI when ok is false. */
  message?: string;
}

const NOT_CONFIGURED_RESULT: PushActionResult = {
  ok: false,
  message: "Push notifications aren't available right now.",
};

const NOT_SUPPORTED_RESULT: PushActionResult = {
  ok: false,
  message: "This browser doesn't support push notifications.",
};

const PERMISSION_DENIED_RESULT: PushActionResult = {
  ok: false,
  message:
    "Notification permission was denied. You can turn this on again from your browser's site settings.",
};

function pushSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window
  );
}

/** Converts a base64url-encoded VAPID public key into the Uint8Array shape PushManager.subscribe expects. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** Base64-encodes a raw key ArrayBuffer (as returned by PushSubscription.getKey). */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Requests notification permission, registers the service worker, subscribes
 * to push, and upserts the subscription for `profileId` into
 * `public.push_subscriptions`. Never throws for expected failure paths
 * (unsupported browser, permission denied, backend not configured) — callers
 * should branch on `ok`, not wrap this in try/catch.
 */
export async function enableCheckInPush(
  profileId: string
): Promise<PushActionResult> {
  if (!isSupabaseConfigured() || !supabase) {
    return NOT_CONFIGURED_RESULT;
  }
  if (!pushSupported()) {
    return NOT_SUPPORTED_RESULT;
  }

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    return NOT_CONFIGURED_RESULT;
  }

  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch {
    return NOT_SUPPORTED_RESULT;
  }
  if (permission === "denied") {
    return PERMISSION_DENIED_RESULT;
  }
  if (permission !== "granted") {
    return { ok: false, message: "Notification permission wasn't granted." };
  }

  try {
    const registration =
      await navigator.serviceWorker.register(SERVICE_WORKER_URL);
    const readyRegistration = await navigator.serviceWorker.ready.catch(
      () => registration
    );

    const subscription = await readyRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        vapidPublicKey
      ) as BufferSource,
    });

    const p256dhKey = subscription.getKey("p256dh");
    const authKey = subscription.getKey("auth");
    if (!p256dhKey || !authKey) {
      return {
        ok: false,
        message: "Couldn't set up push notifications on this device.",
      };
    }

    const { error } = await supabase.from(PUSH_SUBSCRIPTIONS_TABLE).upsert(
      {
        profile_id: profileId,
        endpoint: subscription.endpoint,
        p256dh: arrayBufferToBase64(p256dhKey),
        auth: arrayBufferToBase64(authKey),
      },
      { onConflict: "endpoint" }
    );
    if (error) {
      return {
        ok: false,
        message:
          "Couldn't save your notification preference. Please try again.",
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "Couldn't set up push notifications on this device.",
    };
  }
}

/**
 * Unsubscribes the current device from push locally and removes its row from
 * `public.push_subscriptions`. Safe to call even if no subscription exists.
 */
export async function disableCheckInPush(): Promise<PushActionResult> {
  if (!pushSupported()) {
    return NOT_SUPPORTED_RESULT;
  }

  try {
    const registration =
      await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) {
      return { ok: true };
    }

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();

    if (isSupabaseConfigured() && supabase) {
      await supabase
        .from(PUSH_SUBSCRIPTIONS_TABLE)
        .delete()
        .eq("endpoint", endpoint);
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "Couldn't turn off push notifications. Please try again.",
    };
  }
}
