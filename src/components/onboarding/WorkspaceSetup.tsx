// Create-or-join UI for a healthcare workspace (organisation). Shared
// between OnboardingFlow (healthcare signup) and ProfilePage (an
// already-onboarded healthcare account that hasn't set up/joined a
// workspace yet, or whose earlier onboarding ran before they'd finished
// signing in — see the caller-side note in OnboardingFlow.tsx).
//
// Requires an actual signed-in Supabase session: both underlying RPCs
// (create_organisation / redeem_organisation_invite) read auth.uid() and
// look up the caller's public.users row for their role, so there is no
// meaningful "local-only" version of this action — callers are expected to
// only render this once signed in.

import { useState } from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Field, Input } from "../ui/Field";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import type { Role } from "../../types";
import {
  createOrganisation,
  redeemOrganisationInvite,
} from "../../lib/supabase/organisations";

type SetupMode = "create" | "join";

const MODE_OPTIONS: { value: SetupMode; label: string }[] = [
  { value: "create", label: "Create a workspace" },
  { value: "join", label: "Join with a code" },
];

export interface WorkspaceSetupProps {
  role?: Role;
  canCreateWorkspace?: boolean;
  onJoined: (organisationId: string, organisationName: string | null) => void;
}

export function WorkspaceSetup({
  role,
  canCreateWorkspace,
  onJoined,
}: WorkspaceSetupProps) {
  const canCreate = canCreateWorkspace ?? (role === "clinician" || !role);
  const [mode, setMode] = useState<SetupMode>(canCreate ? "create" : "join");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeMode = canCreate ? mode : "join";

  const submit = async () => {
    setError(null);
    setBusy(true);
    if (activeMode === "create") {
      const result = await createOrganisation(name.trim() || "My team");
      setBusy(false);
      if (result.error || !result.organisationId) {
        setError(result.error?.message ?? "Couldn't create the workspace.");
        return;
      }
      onJoined(result.organisationId, name.trim() || "My team");
    } else {
      const result = await redeemOrganisationInvite(code.trim());
      setBusy(false);
      if (result.error || !result.organisationId) {
        setError(result.error?.message ?? "Couldn't join that workspace.");
        return;
      }
      onJoined(result.organisationId, null);
    }
  };

  return (
    <Card className="p-5 space-y-3">
      <p className="text-sm font-semibold text-navy-800">Team workspace</p>
      <p className="text-xs text-fog-500">
        {canCreate
          ? "A workspace is a shared patient list your whole team can see. Create one for your team, or join theirs with a code they share with you."
          : "A workspace is a shared patient list your whole team can see. Join your team's workspace with an invite code provided by your clinician or team lead."}
      </p>
      {canCreate && (
        <SegmentedTabs
          label="Workspace setup"
          value={mode}
          onChange={setMode}
          options={MODE_OPTIONS}
        />
      )}
      {activeMode === "create" ? (
        <Field label="Workspace name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ward 4B team"
          />
        </Field>
      ) : (
        <Field label="Invite code">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. A1B2C3D4"
          />
        </Field>
      )}
      {error && <p className="text-xs text-alert-600">{error}</p>}
      <Button
        fullWidth
        onClick={submit}
        disabled={busy || (activeMode === "create" ? false : !code.trim())}
      >
        {busy
          ? "Working…"
          : activeMode === "create"
            ? "Create workspace"
            : "Join workspace"}
      </Button>
    </Card>
  );
}
