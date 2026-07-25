import { NavLink } from "react-router-dom";
import { Gauge, Flask, UserCircle } from "@phosphor-icons/react";
import { NAV_ITEMS } from "./navConfig";
import { useStore } from "../../store/useStore";
import { BrandLogo } from "../ui/BrandLogo";

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="px-3 pt-4 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-fog-400">
      {children}
    </p>
  );
}

function SidebarLink({
  to,
  icon: Icon,
  label,
  end,
}: {
  to: string;
  icon: typeof Gauge;
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${
          isActive
            ? "bg-intake-50 text-intake-700"
            : "text-navy-700 hover:bg-fog-50"
        }`
      }
    >
      <Icon size={20} aria-hidden="true" />
      {label}
    </NavLink>
  );
}

export function Sidebar() {
  const organisationName = useStore((s) => s.currentUser.organisationName);
  const activePatientId = useStore((s) => s.activePatientId);
  const patients = useStore((s) => s.patients);
  const activePatient = patients.find((p) => p.id === activePatientId);

  return (
    <nav
      aria-label="Primary"
      className="hidden md:flex w-64 shrink-0 flex-col border-r border-navy-900/10 bg-white py-5"
    >
      <div className="px-6 pb-5">
        <BrandLogo size="md" subtitle={organisationName || "Healthcare team"} />
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        <SectionLabel>Workspace</SectionLabel>
        <div className="space-y-0.5">
          <SidebarLink to="/dashboard" icon={Gauge} label="Patient dashboard" />
          <SidebarLink
            to="/drinks"
            icon={Flask}
            label="Patient fluid library"
          />
        </div>

        <SectionLabel>
          {activePatient
            ? `Viewing: ${activePatient.displayName}`
            : "Active patient"}
        </SectionLabel>
        <div className="space-y-0.5">
          {NAV_ITEMS.filter((item) => item.to !== "/profile").map((item) => (
            <SidebarLink
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              end={item.to === "/"}
            />
          ))}
        </div>
      </div>

      <div className="px-3 pt-3 border-t border-navy-900/10">
        <SidebarLink to="/profile" icon={UserCircle} label="Account" />
      </div>
    </nav>
  );
}
