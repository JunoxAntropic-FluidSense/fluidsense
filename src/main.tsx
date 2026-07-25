import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { AuthBootstrap } from "./lib/supabase/AuthBootstrap.tsx";

// Registers the service worker that displays/handles check-in reminder push
// notifications. Registration only makes the worker available — it never
// requests notification permission or subscribes to push on its own; that
// only happens when the user opts in via the Profile page toggle (see
// src/lib/push/subscribe.ts).
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js").catch(() => {
    // Non-fatal: the app works fully without push notifications.
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthBootstrap>
        <App />
      </AuthBootstrap>
    </ErrorBoundary>
  </StrictMode>
);
