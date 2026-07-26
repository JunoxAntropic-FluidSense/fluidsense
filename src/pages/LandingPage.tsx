// Public marketing landing page, built on the Marque editorial brand handbook design.
// Standalone from the product UI's component library on purpose — this page sells
// the product, it doesn't need to share Button/Card with the authenticated app.
//
// Every "Get started" / "Sign in" control routes to /welcome — the existing
// sign-in/onboarding entry point — this page never handles auth itself.

import { useEffect, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle,
  FileCode,
  Folder,
  Microphone,
  Play,
  Users,
} from "@phosphor-icons/react";
import { useStore } from "../store/useStore";
import { useAuthStore } from "../store/useAuthStore";
import "./LandingPage.css";

export function LandingPage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const onboardingCompleted = useStore(
    (s) => s.currentUser.onboardingCompleted
  );
  const viewContext = useStore((s) => s.viewContext);
  const authStatus = useAuthStore((s) => s.status);

  const goToSignIn = () => navigate("/welcome");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = 640;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const css = (name: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim();

    // Four rings, each styled to match the status legend: measured = solid,
    // container-estimate = solid-translucent, approximate = dashed,
    // unmeasured = sparse dotted.
    const rings = [
      {
        baseR: 60,
        speed: 0.55,
        color: () => css("--color-success") || "#3f9c37",
        dash: [] as number[],
        width: 3,
        alpha: 0.95,
      },
      {
        baseR: 100,
        speed: 0.4,
        color: () => css("--color-indigo") || "#0a81d1",
        dash: [] as number[],
        width: 3.5,
        alpha: 0.65,
      },
      {
        baseR: 140,
        speed: -0.25,
        color: () => css("--color-warn") || "#b3791f",
        dash: [12, 10],
        width: 2,
        alpha: 0.85,
      },
      {
        baseR: 180,
        speed: 0.15,
        color: () => css("--color-whisper") || "#6b6680",
        dash: [3, 14],
        width: 2,
        alpha: 0.45,
      },
    ];

    let angles = [0, 0, 0, 0];
    let animationFrameId: number;

    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;

      // Draw background grid lines matching Marque aesthetics
      ctx.strokeStyle = css("--color-hairline") || "#e6e2e2";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(size, cy);
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, size);
      ctx.stroke();

      rings.forEach((ring, i) => {
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = ring.color();
        ctx.lineWidth = ring.width;
        ctx.globalAlpha = ring.alpha;
        if (ring.dash.length > 0) {
          ctx.setLineDash(ring.dash);
        }

        ctx.arc(cx, cy, ring.baseR, 0, Math.PI * 2);
        ctx.stroke();

        // Draw an accent indicator bead on each ring to show movement
        if (!reduceMotion) {
          const angle = angles[i];
          const bx = cx + Math.cos(angle) * ring.baseR;
          const by = cy + Math.sin(angle) * ring.baseR;
          ctx.beginPath();
          ctx.fillStyle = ring.color();
          ctx.globalAlpha = 1.0;
          ctx.arc(bx, by, ring.width * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      if (!reduceMotion) {
        angles = angles.map((a, i) => a + (rings[i].speed * Math.PI) / 180);
        animationFrameId = requestAnimationFrame(draw);
      }
    }

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in-view");
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -50px 0px" }
    );

    const targets = document.querySelectorAll(
      ".scroll-animate, .product-card, .photo-card, .royal__title, .royal__body"
    );
    targets.forEach((t) => observer.observe(t));

    return () => {
      targets.forEach((t) => observer.unobserve(t));
    };
  }, []);

  // Already signed in and set up (or in demo mode) — skip the pitch,
  // straight into the app.
  if (
    viewContext === "demo" ||
    (authStatus === "signed-in" && onboardingCompleted)
  ) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="landing-page-body">
      {/* Frame / Topbar */}
      <header className="topbar">
        <div className="topbar__inner">
          <a href="#" className="logo-section flex items-center gap-2">
            <img src="/logo.png" alt="" className="h-6 w-6 object-contain" />
            <span className="font-extrabold text-lg tracking-tight text-[var(--color-ink)]">
              FluidSense
            </span>
          </a>
          <nav className="nav__links flex items-center gap-6 hidden md:flex">
            <a
              href="#how"
              className="text-sm font-semibold text-[var(--color-whisper)] hover:text-[var(--color-indigo)]"
            >
              How it works
            </a>
            <a
              href="#honesty"
              className="text-sm font-semibold text-[var(--color-whisper)] hover:text-[var(--color-indigo)]"
            >
              Four Statuses
            </a>
            <a
              href="#who"
              className="text-sm font-semibold text-[var(--color-whisper)] hover:text-[var(--color-indigo)]"
            >
              Who it's for
            </a>
          </nav>
          <div className="topbar__cta">
            <button onClick={goToSignIn} className="btn btn-secondary btn-sm">
              Sign in
            </button>
            <button onClick={goToSignIn} className="btn btn-sm">
              Get started
            </button>
          </div>
        </div>
      </header>

      {/* Opening / Hero Section */}
      <section className="opening" id="how">
        <div className="opening__inner">
          <div className="opening__main">
            <span className="label flex items-center gap-2">
              <span className="dot" aria-hidden="true"></span>
              Voice-First Clinical Tracking
            </span>
            <h1 className="opening__title">
              Every fluid tracked. Nothing <em>guessed</em>.
            </h1>
            <p className="opening__lead">
              Log a drink or a urine output by voice in seconds. FluidSense
              records it instantly and always tells you whether that number was
              measured, estimated, or never recorded at all.
            </p>
            <div className="opening__cta">
              <button onClick={goToSignIn} className="btn">
                Get started free
                <ArrowRight size={16} weight="bold" className="ml-1" />
              </button>
              <button
                onClick={() => {
                  useStore.getState().enterDemoMode();
                  navigate("/");
                }}
                className="btn btn-secondary"
              >
                <Play size={16} weight="fill" className="mr-1" />
                Explore demo
              </button>
            </div>
          </div>
          <figure className="opening__visual relative overflow-hidden">
            <img
              src="/today-screenshot.png"
              alt="FluidSense Today View"
              className="w-full h-full object-cover object-top"
            />
            <figcaption className="opening__caption">
              <span>
                <span className="dot" aria-hidden="true"></span>Active Client
              </span>
              <span>Today View</span>
            </figcaption>
          </figure>
        </div>

        <div className="opening__strip">
          <div className="opening__stat">
            <b>
              4<em>statuses</em>
            </b>
            <span>Honesty first</span>
          </div>
          <div className="opening__stat">
            <b>
              1<em>tap</em>
            </b>
            <span>Confirms every voice entry</span>
          </div>
          <div className="opening__stat">
            <b>
              Epic<em>ready</em>
            </b>
            <span>FHIR sandbox included</span>
          </div>
          <div className="opening__stat">
            <b>
              0<em>account</em>
            </b>
            <span>Try the demo instantly</span>
          </div>
        </div>
      </section>

      {/* Imagery/caseload Section */}
      <section className="spread" id="who">
        <header className="spread__head">
          <h2 className="spread__title scroll-animate">
            One record, read the same way
            <span className="accent"> by everyone who sees it.</span>
          </h2>
          <p className="spread__sub scroll-animate">
            Patient mode and healthcare mode share one data model. A clinician
            reviewing a chart sees the exact same measured, estimated, or
            unmeasured status a patient logged at home.
          </p>
        </header>

        <div className="spread__grid grid md:grid-cols-2 gap-6">
          <div className="photo-card">
            <div className="photo-card__body p-6 flex flex-col justify-between h-full min-h-[220px]">
              <div>
                <span className="tag photo-card__tag mb-3 flex items-center gap-1.5 w-fit">
                  <Microphone size={14} weight="fill" />
                  Voice Capture
                </span>
                <h3 className="headline-sm">Speak naturally mid-task.</h3>
                <p className="body-sm muted mt-2">
                  "I drank about half a mug of tea, and passed 300 mL of urine"
                  — spoken numbers, categories, and container fractions
                  understood as-is.
                </p>
              </div>
            </div>
          </div>

          <div className="photo-card spec-card spec-card--veil p-6">
            <div className="flex flex-col gap-4 h-full">
              <h3 className="spec-card__heading font-extrabold text-xl">
                Clinical integrity guidelines.
              </h3>
              <ul className="principle__list space-y-3">
                <li className="flex items-start gap-2 text-sm text-[var(--color-ink-soft)]">
                  <CheckCircle
                    size={18}
                    className="text-[var(--color-indigo)] shrink-0 mt-0.5"
                  />
                  Patient data is access-controlled and only ever shared with
                  the people you allow.
                </li>
                <li className="flex items-start gap-2 text-sm text-[var(--color-ink-soft)]">
                  <CheckCircle
                    size={18}
                    className="text-[var(--color-indigo)] shrink-0 mt-0.5"
                  />
                  Balance totals never blend a measured number with a guess.
                </li>
                <li className="flex items-start gap-2 text-sm text-[var(--color-ink-soft)]">
                  <CheckCircle
                    size={18}
                    className="text-[var(--color-indigo)] shrink-0 mt-0.5"
                  />
                  Tested against Epic's real FHIR sandbox, not a mock.
                </li>
                <li className="flex items-start gap-2 text-sm text-[var(--color-ink-soft)]">
                  <CheckCircle
                    size={18}
                    className="text-[var(--color-indigo)] shrink-0 mt-0.5"
                  />
                  Never tells you what your numbers mean medically — that's for
                  your care team.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Royal Block */}
      <section className="royal">
        <div className="royal__inner">
          <svg
            className="royal__orb"
            viewBox="0 0 337.67 337.68"
            aria-hidden="true"
          >
            <path
              d="M137.65 2.89L6.47 122.39c-2.25 7.86-3.93 15.97-5.02 24.25L162.27.14c-8.38.32-16.6 1.25-24.62 2.75Z"
              fill="currentColor"
            />
            <path
              d="M15.4 98.32L112.89 9.51C69.62 24.7 34.42 57.01 15.4 98.32Z"
              fill="currentColor"
            />
            <path
              d="M180.88.43L.05 165.17c-.03 1.22-.05 2.44-.05 3.67 0 5.2.25 10.34.71 15.41L199.83 2.85c-6.21-1.15-12.53-1.96-18.95-2.42Z"
              fill="currentColor"
            />
            <path
              d="M214.9 6.36L2.8 199.59c1.01 5.5 2.29 10.9 3.82 16.2L230.67 11.68c-5.14-2.02-10.4-3.8-15.77-5.32Z"
              fill="currentColor"
            />
            <path
              d="M243.4 17.33L11.05 229c1.83 4.81 3.88 9.51 6.13 14.1L256.87 24.74c-4.36-2.67-8.85-5.14-13.46-7.42Z"
              fill="currentColor"
            />
            <path
              d="M267.79 32.04L23.42 254.66c2.51 4.24 5.19 8.36 8.05 12.35L279.35 41.19c-3.71-3.22-7.57-6.27-11.56-9.15Z"
              fill="currentColor"
            />
            <path
              d="M288.69 49.93L39.3 277.12c3.11 3.72 6.38 7.31 9.8 10.75L298.48 60.69c-3.11-3.73-6.38-7.32-9.79-10.76Z"
              fill="currentColor"
            />
            <path
              d="M306.31 70.8L58.46 296.6c3.72 3.21 7.58 6.26 11.57 9.14l244.32-222.58c-2.5-4.24-5.18-8.37-8.03-12.36Z"
              fill="currentColor"
            />
            <path
              d="M320.58 94.73l-239.61 218.29c4.37 2.67 8.86 5.13 13.48 7.4l232.25-211.59c-1.83-4.81-3.87-9.52-6.12-14.11Z"
              fill="currentColor"
            />
            <path
              d="M331.11 122.07l-223.92 203.99c5.14 2.02 10.41 3.79 15.78 5.3l211.94-193.08c-1.01-5.5-2.28-10.91-3.8-16.22Z"
              fill="currentColor"
            />
            <path
              d="M337.67 168.84c0-5.12-.24-10.19-.69-15.2l-198.93 181.23c6.21 1.14 12.55 1.95 18.98 2.39l180.59-164.52c.03-1.3.05-2.6.05-3.9Z"
              fill="currentColor"
            />
            <path
              d="M331.11 215.61c2.27-7.88 3.97-16 5.08-24.31l-160.51 146.22c8.4-.33 16.64-1.28 24.68-2.8l130.75-119.12Z"
              fill="currentColor"
            />
            <path
              d="M320.9 242.29l-93.06 84.78c40.85-15.24 74.21-45.84 93.06-84.78Z"
              fill="currentColor"
            />
          </svg>
          <div className="royal__stripes" aria-hidden="true"></div>

          <h2 className="royal__title scroll-animate">
            Every number comes with its own honesty rating.
          </h2>
          <div className="royal__body scroll-animate">
            <p className="lead">
              One shared timeline connects the ward round to the kitchen table.
              Every balance total comes with a reliability readout, so
              clinicians know how complete the picture is — not just what the
              number says.
            </p>
            <div className="royal__cta">
              <button onClick={goToSignIn} className="btn btn-on-royal">
                Get started free
              </button>
              <button onClick={goToSignIn} className="btn btn-on-royal-outline">
                Login to your team
              </button>
            </div>
          </div>

          <div className="royal__stats">
            <div className="stat">
              <span className="stat__value">Offline</span>
              <span className="stat__label">Demo mode needs no connection</span>
            </div>
            <div className="stat">
              <span className="stat__value">Real-time</span>
              <span className="stat__label">
                Care teams see updates instantly
              </span>
            </div>
            <div className="stat">
              <span className="stat__value">4-way</span>
              <span className="stat__label">Honesty status on every entry</span>
            </div>
            <div className="stat">
              <span className="stat__value">Epic</span>
              <span className="stat__label">FHIR sandbox integration</span>
            </div>
          </div>
        </div>
      </section>

      {/* Editorial Row */}
      <section className="editorial-row" id="honesty">
        <div className="editorial-row__grid">
          <article className="principle">
            <h3 className="principle__title">
              Designed for patients.
              <br />
              Built for clinicians.
            </h3>
            <ul className="principle__list space-y-3">
              <li className="flex items-start gap-2">
                <CheckCircle
                  size={18}
                  className="text-[var(--color-indigo)] shrink-0 mt-0.5"
                />
                No account needed to try it — tap Explore demo to see the real
                interface with fictional data.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle
                  size={18}
                  className="text-[var(--color-indigo)] shrink-0 mt-0.5"
                />
                Offline-first: entries save on your device first, and sync
                automatically once you're back online.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle
                  size={18}
                  className="text-[var(--color-indigo)] shrink-0 mt-0.5"
                />
                You're in control of your data — back up or restore your own
                records any time, with or without a care team.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle
                  size={18}
                  className="text-[var(--color-indigo)] shrink-0 mt-0.5"
                />
                Every check-in, check-out, and edit is timestamped — a full
                audit trail for the team.
              </li>
            </ul>
          </article>

          <article className="signature-card">
            <span className="tag tag-solid mb-4 w-fit flex items-center gap-1.5">
              <Users size={14} />
              Roster Sync
            </span>
            <h3>Real-time team coordination.</h3>
            <p>
              Nurses check in to a patient to add notes and verify entries.
              Every check-in creates a timestamped log entry, so the whole team
              can see who did what, and when.
            </p>
            <div className="row flex items-center gap-3 mt-4">
              <span className="tag tag-solid">Clinical audit trail</span>
              <span className="tag">Check-in / Check-out</span>
            </div>
          </article>
        </div>
      </section>

      {/* Workshop */}
      <section className="workshop" id="identity">
        <header className="workshop__head">
          <h2 className="scroll-animate">See it before you sign in.</h2>
          <p className="lead scroll-animate">
            Three real screens from the actual product — not mockups.
          </p>
        </header>

        <div className="workshop__grid">
          <article className="product-card">
            <div className="product-card__photo relative overflow-hidden">
              <span className="tag tag-solid badge flex items-center gap-1.5 absolute top-3 left-3 z-10">
                <Folder size={12} weight="fill" />
                Caseload Roster
              </span>
              <img
                src="/dashboard-screenshot.png"
                alt="Clinician Dashboard"
                className="w-full h-full object-cover object-top"
              />
            </div>
            <div className="product-card__body">
              <h3 className="product-card__title">Clinician Dashboard</h3>
              <p className="body-sm muted max-w-[32ch] mt-1">
                Caseload roster, check-in timeline, and each patient's fluid
                balance in one view.
              </p>
            </div>
          </article>

          <article className="product-card">
            <div className="product-card__photo relative overflow-hidden">
              <span className="tag tag-solid badge flex items-center gap-1.5 absolute top-3 left-3 z-10">
                <Microphone size={12} weight="fill" />
                Confirm screen
              </span>
              <img
                src="/voice-screenshot.png"
                alt="Voice Capture Interface"
                className="w-full h-full object-cover object-top"
              />
            </div>
            <div className="product-card__body">
              <h3 className="product-card__title">Voice Capture Dialog</h3>
              <p className="body-sm muted max-w-[32ch] mt-1">
                Speak an entry, then confirm the amount and category before
                anything saves.
              </p>
            </div>
          </article>

          <article className="product-card">
            <div className="product-card__photo relative overflow-hidden">
              <span className="tag tag-solid badge flex items-center gap-1.5 absolute top-3 left-3 z-10">
                <FileCode size={12} weight="fill" />
                Epic Sandbox
              </span>
              <img
                src="/epic-screenshot.png"
                alt="Epic EHR Integration"
                className="w-full h-full object-cover object-top"
              />
            </div>
            <div className="product-card__body">
              <h3 className="product-card__title">Epic EHR Integration</h3>
              <p className="body-sm muted max-w-[32ch] mt-1">
                Pulls real patient data from Epic's public FHIR sandbox —
                vitals, medications, and encounters, alongside recorded fluids.
              </p>
            </div>
          </article>
        </div>
      </section>

      {/* Footer */}
      <footer className="colophon">
        <div className="colophon__inner">
          <div className="colophon__brand-col">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="" className="h-7 w-7 object-contain" />
              <span className="font-display font-black text-xl tracking-tight text-white">
                FluidSense
              </span>
              <span className="colophon__prototype-badge">Prototype</span>
            </div>
            <p className="colophon__brand-desc">
              Voice-first fluid intake and output tracking. Built to keep care
              teams in sync, from the ward round to the kitchen table.
            </p>
          </div>

          <div className="colophon__grid">
            <div className="colophon__column">
              <h4>Product</h4>
              <ul>
                <li>
                  <a onClick={() => navigate("/landing")}>Home</a>
                </li>
                <li>
                  <a onClick={goToSignIn}>Sign in</a>
                </li>
                <li>
                  <a onClick={goToSignIn}>Get started</a>
                </li>
              </ul>
            </div>
            <div className="colophon__column">
              <h4>Explore (sign-in required)</h4>
              <ul>
                <li>
                  <a onClick={() => navigate("/epic-sandbox")}>
                    Epic integration
                  </a>
                </li>
                <li>
                  <a onClick={() => navigate("/drinks")}>Drink presets</a>
                </li>
                <li>
                  <a onClick={() => navigate("/")}>Today view</a>
                </li>
              </ul>
            </div>
            <div className="colophon__column">
              <h4>Legal</h4>
              <ul>
                <li>
                  <a onClick={() => navigate("/privacy")}>Privacy Policy</a>
                </li>
                <li>
                  <a onClick={() => navigate("/terms")}>Terms of Service</a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="colophon__base">
          <span>
            &copy; {new Date().getFullYear()} FluidSense. All rights reserved.
          </span>
          <span>
            FluidSense is a prototype. It is not a certified clinical device.
          </span>
        </div>
      </footer>
    </div>
  );
}
