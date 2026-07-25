import { NavLink } from "react-router-dom";
import { Gauge, Flask } from "@phosphor-icons/react";
import { NAV_ITEMS } from "./navConfig";
import { useStore } from "../../store/useStore";

export function Sidebar() {
  const organisationName = useStore((s) => s.currentUser.organisationName);

  return (
    <nav
      aria-label="Primary"
      className="hidden md:flex w-60 shrink-0 flex-col border-r border-navy-900/10 bg-white px-3 py-6 gap-1"
    >
      <div className="px-3 pb-4">
        <p className="text-lg font-extrabold text-navy-900 tracking-tight">
          FluidSense
        </p>
        <p className="text-xs text-fog-500">
          {organisationName || "Healthcare team mode"}
        </p>
      </div>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${
              isActive
                ? "bg-intake-50 text-intake-700"
                : "text-navy-700 hover:bg-fog-50"
            }`
          }
        >
          <item.icon size={20} aria-hidden="true" />
          {item.label}
        </NavLink>
      ))}
      <NavLink
        to="/dashboard"
        className={({ isActive }) =>
          `mt-2 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${
            isActive
              ? "bg-output-50 text-output-700"
              : "text-navy-700 hover:bg-fog-50"
          }`
        }
      >
        <Gauge size={20} aria-hidden="true" />
        Patient dashboard
      </NavLink>
      <NavLink
        to="/drinks"
        className={({ isActive }) =>
          `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${
            isActive
              ? "bg-output-50 text-output-700"
              : "text-navy-700 hover:bg-fog-50"
          }`
        }
      >
        <Flask size={20} aria-hidden="true" />
        Patient fluid library
      </NavLink>
    </nav>
  );
}
