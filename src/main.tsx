import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { AuthBootstrap } from "./lib/supabase/AuthBootstrap.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthBootstrap>
        <App />
      </AuthBootstrap>
    </ErrorBoundary>
  </StrictMode>
);
