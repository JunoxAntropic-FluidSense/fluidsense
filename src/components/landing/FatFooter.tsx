// Modern multi-column "fat footer" — editorial dark anchor block, the same
// role Marque's design system reserves for its one "royal" deep-surface
// panel per page (here: hero + footer bookend), recolored to FluidSense's
// own navy/intake tokens instead of Marque's violet.
import { Drop } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";

const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] =
  [
    {
      heading: "Product",
      links: [
        { label: "How it works", href: "#how" },
        { label: "The four statuses", href: "#honesty" },
        { label: "Who it's for", href: "#who" },
      ],
    },
    {
      heading: "Account",
      links: [
        { label: "Sign in", href: "/welcome" },
        { label: "Get started", href: "/welcome" },
      ],
    },
    {
      heading: "Legal",
      links: [
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
      ],
    },
  ];

export function FatFooter() {
  const navigate = useNavigate();

  const go = (href: string) => {
    if (href.startsWith("#")) {
      document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate(href);
    }
  };

  return (
    <footer className="bg-navy-950 text-fog-200">
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-10">
        <div className="grid md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10">
          <div>
            <div className="flex items-center gap-2 text-white font-extrabold text-lg">
              <Drop size={22} weight="fill" className="text-intake-400" />
              FluidSense
            </div>
            <p className="mt-4 text-sm text-fog-400 max-w-xs leading-relaxed">
              Voice-first fluid intake and output tracking that never blurs a
              guess into a fact.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <p className="font-mono text-xs font-semibold uppercase tracking-widest text-fog-500 mb-4">
                {col.heading}
              </p>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <button
                      onClick={() => go(link.href)}
                      className="text-sm text-fog-300 hover:text-white transition-colors cursor-pointer text-left"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-fog-500">
          <span>
            FluidSense is a prototype. It is not a certified clinical device.
          </span>
          <span className="font-mono">
            &copy; {new Date().getFullYear()} FluidSense
          </span>
        </div>
      </div>
    </footer>
  );
}
