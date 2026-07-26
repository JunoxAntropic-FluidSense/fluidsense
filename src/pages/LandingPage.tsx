// Public marketing landing page, built on real Aceternity UI components
// (installed via shadcn into src/components/ui/ — background-beams,
// resizable-navbar, hero-highlight, bento-grid, text-generate-effect)
// rather than hand-rolled CSS, recolored to this app's own brand tokens
// (src/index.css) instead of their stock indigo/purple defaults.
//
// Every "Get started" / "Sign in" control routes to /welcome — the existing
// sign-in/onboarding entry point — this page never handles auth itself.

import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Drop, Microphone, ShieldCheck, Waveform } from "@phosphor-icons/react";
import { useStore } from "../store/useStore";
import { useAuthStore } from "../store/useAuthStore";
import { BackgroundBeams } from "../components/ui/background-beams";
import { HeroHighlight, Highlight } from "../components/ui/hero-highlight";
import { TextGenerateEffect } from "../components/ui/text-generate-effect";
import { BentoGrid, BentoGridItem } from "../components/ui/bento-grid";
import {
  Navbar,
  NavBody,
  NavItems,
  NavbarButton,
  MobileNav,
  MobileNavHeader,
  MobileNavMenu,
  MobileNavToggle,
} from "../components/ui/resizable-navbar";

const NAV_ITEMS = [
  { name: "How it works", link: "#how" },
  { name: "The four statuses", link: "#honesty" },
  { name: "Who it's for", link: "#who" },
];

function FluidSenseLogo() {
  return (
    <a
      href="#top"
      className="relative z-20 flex items-center gap-2 px-2 py-1 text-sm font-bold text-navy-900 dark:text-white"
    >
      <Drop size={22} weight="fill" className="text-intake-500" />
      FluidSense
    </a>
  );
}

function StatusRing({
  color,
  opacity = 1,
}: {
  color: string;
  opacity?: number;
}) {
  return (
    <div
      className="h-full w-full rounded-xl flex items-center justify-center"
      style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      <div
        className="h-10 w-10 rounded-full"
        style={{ background: color, opacity }}
      />
    </div>
  );
}

export function LandingPage() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const goToSignIn = () => navigate("/welcome");

  const onboardingCompleted = useStore(
    (s) => s.currentUser.onboardingCompleted
  );
  const viewContext = useStore((s) => s.viewContext);
  const authStatus = useAuthStore((s) => s.status);

  // Already signed in and set up (or in demo mode) — skip the pitch,
  // straight into the app. Marketing copy is for people who aren't in yet.
  if (
    viewContext === "demo" ||
    (authStatus === "signed-in" && onboardingCompleted)
  ) {
    return <Navigate to="/" replace />;
  }

  return (
    <div id="top" className="bg-white dark:bg-black">
      {/* ---------- Navbar (Aceternity resizable-navbar) ---------- */}
      <Navbar>
        <NavBody>
          <FluidSenseLogo />
          <NavItems items={NAV_ITEMS} />
          <div className="relative z-20 flex items-center gap-3">
            <NavbarButton variant="secondary" onClick={goToSignIn}>
              Sign in
            </NavbarButton>
            <NavbarButton variant="gradient" onClick={goToSignIn}>
              Get started
            </NavbarButton>
          </div>
        </NavBody>
        <MobileNav>
          <MobileNavHeader>
            <FluidSenseLogo />
            <MobileNavToggle
              isOpen={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            />
          </MobileNavHeader>
          <MobileNavMenu
            isOpen={mobileOpen}
            onClose={() => setMobileOpen(false)}
          >
            {NAV_ITEMS.map((item) => (
              <a
                key={item.link}
                href={item.link}
                onClick={() => setMobileOpen(false)}
                className="w-full text-navy-800 dark:text-white font-semibold"
              >
                {item.name}
              </a>
            ))}
            <NavbarButton
              variant="secondary"
              onClick={goToSignIn}
              className="w-full"
            >
              Sign in
            </NavbarButton>
            <NavbarButton
              variant="gradient"
              onClick={goToSignIn}
              className="w-full"
            >
              Get started
            </NavbarButton>
          </MobileNavMenu>
        </MobileNav>
      </Navbar>

      {/* ---------- Hero (HeroHighlight + BackgroundBeams) ---------- */}
      <HeroHighlight containerClassName="!h-auto pt-32 pb-24">
        <div className="relative max-w-4xl mx-auto text-center px-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-intake-50 dark:bg-intake-950/40 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-intake-600 dark:text-intake-300 mb-6">
            <Waveform size={14} weight="bold" /> Voice-first fluid tracking
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold text-navy-900 dark:text-white leading-tight tracking-tight">
            Say what you drank.
            <br />
            Know what's{" "}
            <Highlight className="text-navy-900 dark:text-white">
              real
            </Highlight>
            .
          </h1>
          <div className="mt-6 max-w-2xl mx-auto">
            <TextGenerateEffect
              words="FluidSense logs intake and output the moment you speak it, then holds every entry to one honest line: measured, estimated, or unknown."
              className="text-lg text-navy-700 dark:text-fog-300 font-medium"
              duration={0.4}
            />
          </div>
          <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
            <NavbarButton
              variant="gradient"
              onClick={goToSignIn}
              className="text-base px-6 py-3"
            >
              Get started free
            </NavbarButton>
            <NavbarButton
              variant="secondary"
              href="#how"
              className="text-base px-6 py-3"
            >
              See how it works ↓
            </NavbarButton>
          </div>
          <p className="mt-5 text-xs text-fog-500 dark:text-fog-400">
            No card required · Works fully offline · Built for patients, carers,
            and care teams
          </p>
        </div>
      </HeroHighlight>

      {/* ---------- Background beams strip ---------- */}
      <div className="relative h-[22rem] w-full bg-navy-950 overflow-hidden">
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center z-10">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white max-w-2xl">
            Most fluid charts blur a guess into a fact.{" "}
            <span className="text-intake-400">FluidSense never does.</span>
          </h2>
        </div>
        <BackgroundBeams />
      </div>

      {/* ---------- How it works ---------- */}
      <section id="how" className="py-24 max-w-6xl mx-auto px-6">
        <div className="max-w-xl mb-14">
          <p className="text-xs font-bold uppercase tracking-widest text-intake-500 mb-3">
            How it works
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-navy-900 dark:text-white">
            Three steps. Nothing saved without your say-so.
          </h2>
          <p className="mt-3 text-navy-600 dark:text-fog-400">
            Every voice entry ends at a confirmation screen you can edit or
            cancel — never wired to save automatically, no matter how confident
            the transcript sounds.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="rounded-2xl border border-navy-900/10 dark:border-white/10 p-6">
            <div className="flex items-center gap-2 mb-4 text-intake-500">
              <Microphone size={20} weight="fill" />
              <span className="text-xs font-mono font-bold">01 — SPEAK IT</span>
            </div>
            <h3 className="font-bold text-lg text-navy-900 dark:text-white">
              Talk naturally, mid-task
            </h3>
            <p className="mt-2 text-sm text-navy-600 dark:text-fog-400">
              "I drank about half a mug of tea, and passed 300 mL of urine" —
              spoken numbers and container fractions understood as-is.
            </p>
          </div>
          <div className="rounded-2xl border border-navy-900/10 dark:border-white/10 p-6">
            <div className="flex items-center gap-2 mb-4 text-amber-500">
              <ShieldCheck size={20} weight="fill" />
              <span className="text-xs font-mono font-bold">
                02 — CONFIRM IT
              </span>
            </div>
            <h3 className="font-bold text-lg text-navy-900 dark:text-white">
              Review before anything saves
            </h3>
            <p className="mt-2 text-sm text-navy-600 dark:text-fog-400">
              Each detected entry shows its own status and amount, editable
              independently — nothing writes until you tap confirm.
            </p>
          </div>
          <div className="rounded-2xl border border-navy-900/10 dark:border-white/10 p-6">
            <div className="flex items-center gap-2 mb-4 text-output-500">
              <Drop size={20} weight="fill" />
              <span className="text-xs font-mono font-bold">03 — SEE IT</span>
            </div>
            <h3 className="font-bold text-lg text-navy-900 dark:text-white">
              A balance that shows its own gaps
            </h3>
            <p className="mt-2 text-sm text-navy-600 dark:text-fog-400">
              Totals ship with a reliability read on the record itself — built
              from guesses, and it says so.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- The four statuses (BentoGrid) ---------- */}
      <section id="honesty" className="py-24 bg-fog-50 dark:bg-neutral-950">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-xl mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-intake-500 mb-3">
              The core idea
            </p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-navy-900 dark:text-white">
              Four statuses. Never one blurred number.
            </h2>
            <p className="mt-3 text-navy-600 dark:text-fog-400">
              Most tools reduce every entry to a single confident figure.
              FluidSense keeps the distinction visible everywhere it appears.
            </p>
          </div>
          <BentoGrid className="md:auto-rows-[16rem]">
            <BentoGridItem
              header={<StatusRing color="#3f9c37" />}
              title="Measured"
              description="An exact, recorded volume — from a graduated container, a device, or a precise count."
            />
            <BentoGridItem
              header={<StatusRing color="#0a81d1" opacity={0.85} />}
              title="Container estimate"
              description="A known vessel's volume, scaled to how full or empty it was — close, but not exact."
            />
            <BentoGridItem
              header={<StatusRing color="#b3791f" />}
              title="Approximate"
              description={
                'A guided guess — "about half a mug" — recorded as exactly that, not rounded into certainty.'
              }
            />
            <BentoGridItem
              className="md:col-span-3"
              header={<StatusRing color="#797979" opacity={0.4} />}
              title="Unmeasured"
              description="Something happened and is worth knowing about — even with no volume attached at all. Logged, never invented."
            />
          </BentoGrid>
        </div>
      </section>

      {/* ---------- Who it's for ---------- */}
      <section id="who" className="py-24 max-w-6xl mx-auto px-6">
        <div className="max-w-xl mb-14">
          <p className="text-xs font-bold uppercase tracking-widest text-intake-500 mb-3">
            One record, every role
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-navy-900 dark:text-white">
            Patients, carers, and care teams — looking at the same truth.
          </h2>
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            {
              role: "Patients",
              copy: "Log by voice between sips, no manual math, no app-literacy required.",
            },
            {
              role: "Family carers",
              copy: "Track on someone else's behalf with the same honesty rules.",
            },
            {
              role: "Nurses",
              copy: "Verify, correct, or flag entries — every change lands in a visible audit trail.",
            },
            {
              role: "Clinicians",
              copy: "Review a caseload's reliability at a glance before trusting a balance figure.",
            },
          ].map((a) => (
            <div
              key={a.role}
              className="rounded-2xl border border-navy-900/10 dark:border-white/10 p-6 hover:bg-intake-50 dark:hover:bg-intake-950/20 transition-colors"
            >
              <h3 className="font-bold text-navy-900 dark:text-white">
                {a.role}
              </h3>
              <p className="mt-2 text-sm text-navy-600 dark:text-fog-400">
                {a.copy}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="px-6 pb-24">
        <div className="max-w-5xl mx-auto rounded-3xl bg-navy-950 text-white text-center py-16 px-8">
          <h2 className="text-3xl md:text-4xl font-extrabold">
            Start recording the truth, not the tidy version.
          </h2>
          <p className="mt-3 text-fog-300">
            Free to use. Works fully on-device. No clinical claims — just an
            honest record of what was actually seen.
          </p>
          <div className="mt-8 flex justify-center gap-4 flex-wrap">
            <NavbarButton
              variant="gradient"
              onClick={goToSignIn}
              className="text-base px-6 py-3"
            >
              Get started free
            </NavbarButton>
            <NavbarButton
              variant="secondary"
              onClick={goToSignIn}
              className="text-base px-6 py-3 !text-white border border-white/30"
            >
              Sign in
            </NavbarButton>
          </div>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-6 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-navy-900/10 dark:border-white/10 pt-6 text-xs text-fog-500">
          <span>
            FluidSense is a prototype. It is not a certified clinical device.
          </span>
          <div className="flex gap-5">
            <a
              onClick={() => navigate("/privacy")}
              className="cursor-pointer hover:text-navy-700 dark:hover:text-fog-300"
            >
              Privacy
            </a>
            <a
              onClick={() => navigate("/terms")}
              className="cursor-pointer hover:text-navy-700 dark:hover:text-fog-300"
            >
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
