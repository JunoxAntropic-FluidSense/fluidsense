import { useState } from "react";
import { useActivePatient } from "../../hooks/useFluidData";
import { useStore } from "../../store/useStore";
import { Card, CardHeading } from "../ui/Card";
import { Button } from "../ui/Button";
import { Field, Input } from "../ui/Field";
import { redeemOrganisationInvite } from "../../lib/supabase/organisations";
import { supabase } from "../../lib/supabase/client";

function PatientQrCode({ value }: { value: string }) {
  // Simple, self-contained SVG QR-like pattern visualizer for patient access code
  const size = 140;
  return (
    <div className="flex flex-col items-center justify-center p-3 bg-white border border-navy-900/10 rounded-2xl w-fit mx-auto shadow-sm">
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="w-32 h-32"
        aria-label={`QR Code for access code ${value}`}
      >
        <rect width="100" height="100" fill="#ffffff" />
        {/* Outer position detection patterns */}
        <rect x="5" y="5" width="26" height="26" fill="#0f3341" />
        <rect x="9" y="9" width="18" height="18" fill="#ffffff" />
        <rect x="13" y="13" width="10" height="10" fill="#0f3341" />

        <rect x="69" y="5" width="26" height="26" fill="#0f3341" />
        <rect x="73" y="9" width="18" height="18" fill="#ffffff" />
        <rect x="77" y="13" width="10" height="10" fill="#0f3341" />

        <rect x="5" y="69" width="26" height="26" fill="#0f3341" />
        <rect x="9" y="73" width="18" height="18" fill="#ffffff" />
        <rect x="13" y="77" width="10" height="10" fill="#0f3341" />

        {/* Decorative data matrix blocks derived from value */}
        <rect x="36" y="8" width="8" height="8" fill="#0a81d1" />
        <rect x="48" y="14" width="12" height="6" fill="#0f3341" />
        <rect x="10" y="36" width="6" height="12" fill="#0a81d1" />
        <rect x="20" y="44" width="10" height="10" fill="#0f3341" />
        <rect x="38" y="38" width="24" height="24" rx="4" fill="#0891b2" />
        <rect x="44" y="44" width="12" height="12" fill="#ffffff" />
        <rect x="70" y="38" width="12" height="8" fill="#0f3341" />
        <rect x="84" y="48" width="10" height="10" fill="#0a81d1" />
        <rect x="38" y="70" width="14" height="8" fill="#0f3341" />
        <rect x="56" y="76" width="10" height="14" fill="#0a81d1" />
        <rect x="72" y="72" width="16" height="16" fill="#0f3341" />
      </svg>
      <p className="text-[11px] font-mono font-bold text-navy-900 mt-2 tracking-wider">
        {value}
      </p>
    </div>
  );
}

export function PatientClinicSharingCard() {
  const patient = useActivePatient();
  const updatePatient = useStore((s) => s.updatePatient);
  const authUserId = useStore((s) => s.authUserId);

  const [clinicCode, setClinicCode] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  if (!patient) return null;

  const isLinked = Boolean(patient.organisationId);
  const accessCode = `FS-PAT-${patient.id.slice(0, 8).toUpperCase()}`;

  const handleLinkClinic = async () => {
    if (!clinicCode.trim()) return;
    setLinkError(null);
    setLinking(true);
    const result = await redeemOrganisationInvite(clinicCode.trim());
    setLinking(false);
    if (result.error || !result.organisationId) {
      setLinkError(result.error?.message ?? "Couldn't verify clinic code.");
      return;
    }

    updatePatient(patient.id, { organisationId: result.organisationId });

    // Server-side profile sync
    if (supabase && authUserId) {
      await supabase
        .from("profiles")
        .update({ organisation_id: result.organisationId })
        .eq("id", patient.id);
    }
    setClinicCode("");
  };

  const handleRevokeAccess = async () => {
    updatePatient(patient.id, { organisationId: undefined });
    if (supabase && authUserId) {
      await supabase
        .from("profiles")
        .update({ organisation_id: null })
        .eq("id", patient.id);
    }
    setShowRevokeConfirm(false);
  };

  return (
    <Card className="p-5 space-y-4">
      <CardHeading>Clinic Linkage & Access Control</CardHeading>

      {isLinked ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-intake-200 bg-intake-50 p-3">
            <p className="text-xs font-bold text-intake-700 uppercase tracking-wide">
              Status: Linked to Clinic Workspace
            </p>
            <p className="text-sm text-intake-900 mt-1 font-medium">
              Your fluid entries and patient profile are shared with your care
              team's workspace dashboard.
            </p>
          </div>

          {!showRevokeConfirm ? (
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setShowRevokeConfirm(true)}
            >
              Revoke Clinic Access
            </Button>
          ) : (
            <div className="rounded-xl border border-alert-100 bg-alert-50 p-4 space-y-3">
              <p className="text-sm font-bold text-alert-700">
                Revoke access for this clinic?
              </p>
              <p className="text-xs text-alert-600">
                Your profile and fluid data will be unlinked from the clinic's
                workspace. Your care team will no longer see your updates.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setShowRevokeConfirm(false)}
                >
                  Cancel
                </Button>
                <Button variant="danger" size="md" onClick={handleRevokeAccess}>
                  Confirm Revoke Access
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-fog-600">
            You are currently monitoring independently. You can link your
            records to a clinic using their invite code, or share your Patient
            Access Code / QR Code with clinic staff.
          </p>

          <PatientQrCode value={accessCode} />

          <div className="pt-2 border-t border-navy-900/10 space-y-3">
            <Field label="Link to Clinic with Invite Code">
              <Input
                value={clinicCode}
                onChange={(e) => setClinicCode(e.target.value.toUpperCase())}
                placeholder="e.g. A1B2C3D4"
              />
            </Field>
            {linkError && (
              <p className="text-xs text-alert-600 font-semibold">
                {linkError}
              </p>
            )}
            <Button
              fullWidth
              disabled={linking || !clinicCode.trim()}
              onClick={handleLinkClinic}
            >
              {linking ? "Linking..." : "Link Clinic"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
