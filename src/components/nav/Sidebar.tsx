import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Gauge, Flask, UserCircle, SidebarSimple } from "@phosphor-icons/react";
import { NAV_ITEMS } from "./navConfig";
import { useStore } from "../../store/useStore";
import { BrandLogo } from "../ui/BrandLogo";
import { cn } from "../../lib/cn";

function SectionLabel({
  children,
  collapsed,
}: {
  children: string;
  collapsed: boolean;
}) {
  if (collapsed) return <div className="pt-4" />;
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
  collapsed,
}: {
  to: string;
  icon: typeof Gauge;
  label: string;
  end?: boolean;
  collapsed: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      aria-label={label}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-xl py-2.5 text-sm font-semibold",
          collapsed ? "justify-center px-0" : "px-3",
          isActive
            ? "bg-intake-50 text-intake-700"
            : "text-navy-700 hover:bg-fog-50"
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={20}
            weight={isActive ? "fill" : "regular"}
            className="shrink-0"
            aria-hidden="true"
          />
          {!collapsed && label}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const mode = useStore((s) => s.mode);
  const organisationName = useStore((s) => s.currentUser.organisationName);
  const activePatientId = useStore((s) => s.activePatientId);
  const patients = useStore((s) => s.patients);
  const activePatient = patients.find((p) => p.id === activePatientId);
  const [collapsed, setCollapsed] = useState(false);
  const isHealthcare = mode === "healthcare";

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "hidden md:flex shrink-0 flex-col border-r border-navy-900/10 bg-white py-5 transition-[width] duration-200",
        collapsed ? "w-[68px]" : "w-64"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 pb-5",
          collapsed ? "px-3 justify-center" : "px-6 justify-between"
        )}
      >
        {!collapsed && (
          <BrandLogo
            size="md"
            subtitle={
              isHealthcare
                ? organisationName || "Healthcare team"
                : activePatient?.displayName
            }
          />
        )}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-fog-500 hover:bg-fog-50 hover:text-navy-700"
        >
          <SidebarSimple size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3">
        {isHealthcare && (
          <>
            <SectionLabel collapsed={collapsed}>Workspace</SectionLabel>
            <div className="space-y-0.5">
              <SidebarLink
                to="/dashboard"
                icon={Gauge}
                label="Patient dashboard"
                collapsed={collapsed}
              />
              <SidebarLink
                to="/drinks"
                icon={Flask}
                label="Patient fluid library"
                collapsed={collapsed}
              />
            </div>
          </>
        )}

        <SectionLabel collapsed={collapsed}>
          {isHealthcare
            ? activePatient
              ? `Viewing: ${activePatient.displayName}`
              : "Active patient"
            : "Menu"}
        </SectionLabel>
        <div className="space-y-0.5">
          {NAV_ITEMS.filter((item) => item.to !== "/profile").map((item) => (
            <SidebarLink
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              end={item.to === "/"}
              collapsed={collapsed}
            />
          ))}
        </div>
      </div>

      <div className="px-3 pt-3 border-t border-navy-900/10">
        <SidebarLink
          to="/profile"
          icon={UserCircle}
          label="Account"
          collapsed={collapsed}
        />
      </div>
    </nav>
  );
}
