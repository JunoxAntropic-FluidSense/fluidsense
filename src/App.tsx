import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RequireOnboarding } from "./components/nav/RequireOnboarding";
import { WelcomePage } from "./pages/onboarding/WelcomePage";
import { OnboardingFlow } from "./pages/onboarding/OnboardingFlow";
import { TodayPage } from "./pages/TodayPage";
import { AddPage } from "./pages/AddPage";
import { IntakeFlowPage } from "./pages/IntakeFlowPage";
import { OutputFlowPage } from "./pages/OutputFlowPage";
import { VoicePage } from "./pages/VoicePage";
import { HistoryPage } from "./pages/HistoryPage";
import { SummaryPage } from "./pages/SummaryPage";
import { ProfilePage } from "./pages/ProfilePage";
import { DashboardPage } from "./pages/DashboardPage";
import { DrinksPage } from "./pages/DrinksPage";
import { CareLogPage } from "./pages/CareLogPage";
import { DataSettingsPage } from "./pages/DataSettingsPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { TermsPage } from "./pages/TermsPage";
import { AuthCallbackPage } from "./pages/auth/AuthCallbackPage";
import { EpicSandboxPage } from "./pages/EpicSandboxPage";
import { LandingPage } from "./pages/LandingPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/onboarding" element={<OnboardingFlow />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route element={<RequireOnboarding />}>
          <Route path="/" element={<TodayPage />} />
          <Route path="/add" element={<AddPage />} />
          <Route path="/add/intake" element={<IntakeFlowPage />} />
          <Route path="/add/output" element={<OutputFlowPage />} />
          <Route path="/voice" element={<VoicePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/summary" element={<SummaryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings/data" element={<DataSettingsPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/drinks" element={<DrinksPage />} />
          <Route path="/care-log" element={<CareLogPage />} />
          <Route path="/epic-sandbox" element={<EpicSandboxPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
