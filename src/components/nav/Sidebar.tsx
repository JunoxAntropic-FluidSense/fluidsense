import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "./navConfig";

export function Sidebar() {
  return (
    <nav
      aria-label="Primary"
      className="hidden md:flex w-60 shrink-0 flex-col border-r border-navy-900/10 bg-white px-3 py-6 gap-1"
    >
      <div className="px-3 pb-4">
        <p className="text-lg font-extrabold text-navy-900 tracking-tight">
          FluidSense
        </p>
        <p className="text-xs text-fog-500">Healthcare team mode</p>
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
          <span className="text-lg" aria-hidden="true">
            {item.icon}
          </span>
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
        <span className="text-lg" aria-hidden="true">
          🩺
        </span>
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
        <span className="text-lg" aria-hidden="true">
          🧪
        </span>
        Patient fluid library
      </NavLink>
    </nav>
  );
}
