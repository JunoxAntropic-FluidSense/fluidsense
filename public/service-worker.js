// FluidSense service worker.
//
// Scope: displays and routes check-in reminder push notifications only
// ("Time to log your morning/afternoon/evening fluids"-style copy). The
// actual push payload is produced server-side by a Supabase cron Edge
// Function (see supabase/) — this file never invents or hardcodes anything
// alarming or diagnostic if the payload is missing, per CLAUDE.md's rule
// against diagnostic/clinical-decision language anywhere in the app,
// including notification copy. Plain JS, no build step — served as-is from
// /public.

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "FluidSense";
  const body = payload.body || "Log your fluids";
  const url = payload.url || "/voice";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/logo.png",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url =
    (event.notification.data && event.notification.data.url) || "/voice";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});
