import { NavLink } from "react-router-dom";
import { motion } from "motion/react";
import { NAV_ITEMS } from "./navConfig";
import { useReducedMotion } from "../../hooks/useReducedMotion";

export function BottomNav() {
  const reduceMotion = useReducedMotion();

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-navy-900/10 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-6">
        {NAV_ITEMS.map((item) => (
          <li key={item.to} className="relative">
            <NavLink
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center gap-0.5 py-2 min-h-14 text-[11px] font-semibold ${
                  isActive ? "text-intake-600" : "text-fog-500"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="bottom-nav-active-indicator"
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { type: "spring", bounce: 0.2, duration: 0.4 }
                      }
                      className="absolute inset-x-2 top-1 bottom-1 rounded-xl bg-intake-50"
                    />
                  )}
                  <item.icon
                    size={20}
                    weight={isActive ? "fill" : "regular"}
                    className="relative"
                    aria-hidden="true"
                  />
                  <span className="relative">{item.label}</span>
                  {isActive && <span className="sr-only">(current page)</span>}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
