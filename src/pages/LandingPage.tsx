// Public marketing landing page. Same palette as the rest of the app
// (src/index.css tokens), standalone from the product UI's component
// library on purpose — this page sells the product, it doesn't need to
// share Button/Card with the authenticated app.
//
// Every "Get started" / "Sign in" control routes to /welcome — the existing
// sign-in/onboarding entry point — this page never handles auth itself.

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export function LandingPage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
        color: () => css("--confidence-mint"),
        dash: [] as number[],
        width: 3,
        alpha: 0.95,
      },
      {
        baseR: 100,
        speed: 0.4,
        color: () => css("--accent-intake"),
        dash: [] as number[],
        width: 2.4,
        alpha: 0.65,
      },
      {
        baseR: 145,
        speed: 0.3,
        color: () => css("--confidence-amber"),
        dash: [10, 10],
        width: 2.2,
        alpha: 0.8,
      },
      {
        baseR: 195,
        speed: 0.22,
        color: () => css("--ink-faint"),
        dash: [2, 10],
        width: 2,
        alpha: 0.55,
      },
    ];

    let t = 0;
    let raf: number;
    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, size, size);
      const cx = size / 2;
      const cy = size / 2;
      rings.forEach((ring, i) => {
        const phase = t * ring.speed + i * 1.3;
        const pulse = Math.sin(phase) * 8;
        const r = ring.baseR + pulse;
        ctx.beginPath();
        ctx.setLineDash(ring.dash);
        ctx.lineDashOffset = -t * 20;
        ctx.strokeStyle = ring.color();
        ctx.globalAlpha = ring.alpha;
        ctx.lineWidth = ring.width;
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.fillStyle = css("--accent-intake");
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fill();

      t += reduceMotion ? 0.003 : 0.02;
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const goToSignIn = () => navigate("/welcome");

  return (
    <div className="ls-root">
      <style>{`
        .ls-root {
          --ink: #141414; --ink-soft: #454545; --ink-faint: #797979;
          --canvas: #fcf7f8; --canvas-raised: #ffffff; --line: rgba(20,20,20,0.1);
          --accent-intake: #0a81d1; --accent-intake-soft: #eaf4fc;
          --accent-output: #0d21a1; --accent-output-soft: #eaebf7;
          --confidence-amber: #b3791f; --confidence-amber-soft: #fdf6e7;
          --confidence-mint: #2f7a29; --confidence-mint-soft: #f3fdf1;
          --alert: #a82c21;
          --font-display: -apple-system, "SF Pro Display", "Segoe UI", ui-sans-serif, system-ui, sans-serif;
          --font-body: -apple-system, "SF Pro Text", "Segoe UI", ui-sans-serif, system-ui, sans-serif;
          --font-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
          background: var(--canvas); color: var(--ink); font-family: var(--font-body);
          -webkit-font-smoothing: antialiased; overflow-x: hidden; min-height: 100vh;
        }
        @media (prefers-color-scheme: dark) {
          .ls-root {
            --ink: #f2eeee; --ink-soft: #cfc9c9; --ink-faint: #918c8c;
            --canvas: #131417; --canvas-raised: #1b1c20; --line: rgba(255,255,255,0.1);
            --accent-intake: #4aa8e8; --accent-intake-soft: rgba(74,168,232,0.12);
            --accent-output: #7c8bf0; --accent-output-soft: rgba(124,139,240,0.12);
            --confidence-amber: #d9a84f; --confidence-amber-soft: rgba(217,168,79,0.12);
            --confidence-mint: #5fbf57; --confidence-mint-soft: rgba(95,191,87,0.1);
            --alert: #e0685c;
          }
        }
        .ls-root * { box-sizing: border-box; }
        .ls-root h1, .ls-root h2, .ls-root h3 { font-family: var(--font-display); text-wrap: balance; margin: 0; }
        .ls-root p { margin: 0; }
        .ls-mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
        .ls-root a { color: inherit; }
        .ls-root :focus-visible { outline: 2px solid var(--accent-intake); outline-offset: 3px; border-radius: 4px; }
        @media (prefers-reduced-motion: reduce) {
          .ls-root *, .ls-root *::before, .ls-root *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
        }
        .ls-shell { max-width: 1180px; margin: 0 auto; padding: 0 32px; }
        @media (max-width: 640px) { .ls-shell { padding: 0 20px; } }
        .ls-nav { position: sticky; top: 0; z-index: 40; background: color-mix(in srgb, var(--canvas) 88%, transparent); backdrop-filter: blur(10px); border-bottom: 1px solid var(--line); }
        .ls-nav-row { display: flex; align-items: center; justify-content: space-between; padding: 18px 32px; max-width: 1180px; margin: 0 auto; }
        .ls-brand { display: flex; align-items: center; gap: 10px; font-family: var(--font-display); font-weight: 800; font-size: 18px; letter-spacing: -0.01em; }
        .ls-navlinks { display: flex; align-items: center; gap: 32px; font-size: 14.5px; font-weight: 600; color: var(--ink-soft); }
        .ls-navlinks a { text-decoration: none; transition: color 0.15s; cursor: pointer; }
        .ls-navlinks a:hover { color: var(--ink); }
        @media (max-width: 780px) { .ls-hide-mobile { display: none; } }
        .ls-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-family: var(--font-body); font-weight: 700; font-size: 14.5px; padding: 11px 22px; border-radius: 100px; border: 1px solid transparent; cursor: pointer; text-decoration: none; transition: transform 0.15s, background 0.15s, box-shadow 0.15s; white-space: nowrap; }
        .ls-btn:active { transform: scale(0.97); }
        .ls-btn-primary { background: var(--ink); color: var(--canvas); }
        .ls-btn-primary:hover { box-shadow: 0 6px 20px -6px color-mix(in srgb, var(--ink) 50%, transparent); }
        .ls-btn-ghost { background: transparent; color: var(--ink); border-color: var(--line); }
        .ls-btn-ghost:hover { background: var(--canvas-raised); }
        .ls-hero { padding: 88px 0 64px; }
        .ls-hero-grid { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 56px; align-items: center; }
        @media (max-width: 920px) { .ls-hero-grid { grid-template-columns: 1fr; gap: 40px; } }
        .ls-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent-intake); background: var(--accent-intake-soft); padding: 6px 14px; border-radius: 100px; margin-bottom: 22px; }
        .ls-hero h1 { font-size: clamp(38px, 5.4vw, 60px); line-height: 1.04; font-weight: 800; letter-spacing: -0.025em; }
        .ls-hero h1 em { font-style: normal; color: var(--accent-intake); }
        .ls-hero .ls-sub { margin-top: 22px; font-size: 18px; line-height: 1.55; color: var(--ink-soft); max-width: 46ch; }
        .ls-ctas { display: flex; gap: 14px; margin-top: 34px; flex-wrap: wrap; }
        .ls-fineprint { margin-top: 20px; font-size: 13px; color: var(--ink-faint); }
        .ls-ripple-stage { position: relative; aspect-ratio: 1/1; max-width: 460px; margin: 0 auto; display: flex; align-items: center; justify-content: center; }
        .ls-ripple-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
        .ls-ripple-legend { position: relative; z-index: 2; display: grid; gap: 8px; background: color-mix(in srgb, var(--canvas-raised) 92%, transparent); border: 1px solid var(--line); border-radius: 16px; padding: 14px 16px; backdrop-filter: blur(6px); font-size: 12.5px; font-weight: 600; box-shadow: 0 20px 50px -20px rgba(0,0,0,0.25); }
        .ls-ripple-legend .ls-row { display: flex; align-items: center; gap: 9px; }
        .ls-swatch { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; display: inline-block; }
        .ls-section { padding: 84px 0; }
        .ls-section-head { max-width: 640px; margin-bottom: 48px; }
        .ls-kicker { font-size: 12.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 12px; }
        .ls-section-head h2 { font-size: clamp(28px, 3.4vw, 38px); font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; }
        .ls-section-head p { margin-top: 14px; font-size: 16.5px; color: var(--ink-soft); line-height: 1.6; }
        .ls-problem { background: var(--canvas-raised); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
        .ls-problem-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--line); border-radius: 20px; overflow: hidden; border: 1px solid var(--line); }
        @media (max-width: 780px) { .ls-problem-grid { grid-template-columns: 1fr; } }
        .ls-problem-cell { background: var(--canvas-raised); padding: 32px 28px; }
        .ls-problem-cell .ls-stat { font-family: var(--font-mono); font-size: 34px; font-weight: 700; letter-spacing: -0.02em; }
        .ls-problem-cell .ls-stat.ls-warn { color: var(--alert); }
        .ls-problem-cell p { margin-top: 10px; font-size: 14.5px; color: var(--ink-soft); line-height: 1.5; }
        .ls-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
        @media (max-width: 900px) { .ls-steps { grid-template-columns: 1fr; } }
        .ls-step { display: flex; flex-direction: column; gap: 18px; }
        .ls-step .ls-tag { font-family: var(--font-mono); font-size: 13px; font-weight: 600; color: var(--accent-intake); }
        .ls-step h3 { font-size: 19px; font-weight: 700; letter-spacing: -0.01em; }
        .ls-step p { font-size: 14.5px; color: var(--ink-soft); line-height: 1.55; margin-top: 6px; }
        .ls-mock-card { background: var(--canvas-raised); border: 1px solid var(--line); border-radius: 18px; padding: 18px; box-shadow: 0 16px 40px -24px rgba(0,0,0,0.3); }
        .ls-mock-mic { display: flex; align-items: center; justify-content: center; gap: 10px; background: var(--ink); color: var(--canvas); border-radius: 14px; padding: 20px; font-weight: 700; font-size: 14px; }
        .ls-mock-pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--confidence-mint); animation: ls-pulse 1.6s ease-in-out infinite; }
        @keyframes ls-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.7); } }
        .ls-mock-transcript { font-size: 13px; color: var(--ink-soft); font-style: italic; margin-top: 12px; line-height: 1.5; }
        .ls-mock-confirm-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-top: 1px solid var(--line); font-size: 13.5px; }
        .ls-mock-confirm-row:first-of-type { border-top: none; }
        .ls-mock-badge { font-family: var(--font-mono); font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 100px; }
        .ls-mock-balance { text-align: center; padding: 8px 0; }
        .ls-mock-balance .ls-big { font-family: var(--font-mono); font-size: 30px; font-weight: 700; letter-spacing: -0.02em; }
        .ls-mock-balance .ls-lbl { font-size: 12px; color: var(--ink-faint); margin-top: 2px; }
        .ls-status-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
        @media (max-width: 900px) { .ls-status-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 540px) { .ls-status-grid { grid-template-columns: 1fr; } }
        .ls-status-card { border-radius: 18px; padding: 24px 22px; border: 1px solid var(--line); background: var(--canvas-raised); }
        .ls-status-ring { width: 46px; height: 46px; border-radius: 50%; margin-bottom: 18px; }
        .ls-status-card h3 { font-size: 16px; font-weight: 700; letter-spacing: -0.005em; }
        .ls-status-card p { font-size: 13.5px; color: var(--ink-soft); margin-top: 8px; line-height: 1.5; }
        .ls-aud-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: 20px; overflow: hidden; }
        @media (max-width: 900px) { .ls-aud-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 540px) { .ls-aud-grid { grid-template-columns: 1fr; } }
        .ls-aud-cell { background: var(--canvas-raised); padding: 28px 24px; transition: background 0.2s; }
        .ls-aud-cell:hover { background: var(--accent-intake-soft); }
        .ls-aud-cell h3 { font-size: 15.5px; font-weight: 700; }
        .ls-aud-cell p { font-size: 13.5px; color: var(--ink-soft); margin-top: 8px; line-height: 1.5; }
        .ls-cta { background: var(--ink); color: var(--canvas); border-radius: 28px; padding: 64px 48px; text-align: center; margin: 0 32px; }
        @media (max-width: 640px) { .ls-cta { padding: 44px 24px; margin: 0 20px; } }
        .ls-cta h2 { font-size: clamp(26px, 3.6vw, 36px); font-weight: 800; letter-spacing: -0.02em; }
        .ls-cta p { margin-top: 14px; color: color-mix(in srgb, var(--canvas) 70%, transparent); font-size: 16px; }
        .ls-cta .ls-ctas { justify-content: center; margin-top: 30px; }
        .ls-cta .ls-btn-primary { background: var(--canvas); color: var(--ink); }
        .ls-cta .ls-btn-ghost { border-color: color-mix(in srgb, var(--canvas) 30%, transparent); color: var(--canvas); }
        .ls-cta .ls-btn-ghost:hover { background: color-mix(in srgb, var(--canvas) 12%, transparent); }
        .ls-footer { padding: 40px 0 60px; }
        .ls-foot-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; padding-top: 28px; border-top: 1px solid var(--line); font-size: 13px; color: var(--ink-faint); }
        .ls-foot-links { display: flex; gap: 22px; }
        .ls-foot-links a { text-decoration: none; cursor: pointer; }
        .ls-foot-links a:hover { color: var(--ink-soft); }
      `}</style>

      <nav className="ls-nav">
        <div className="ls-nav-row">
          <div className="ls-brand">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 2C12 2 5 11.2 5 15.5C5 19.09 8.13 22 12 22C15.87 22 19 19.09 19 15.5C19 11.2 12 2 12 2Z"
                fill="var(--accent-intake)"
              />
            </svg>
            FluidSense
          </div>
          <div className="ls-navlinks">
            <a href="#how" className="ls-hide-mobile">
              How it works
            </a>
            <a href="#honesty" className="ls-hide-mobile">
              The four statuses
            </a>
            <a href="#who" className="ls-hide-mobile">
              Who it's for
            </a>
            <a onClick={goToSignIn} className="ls-btn ls-btn-ghost">
              Sign in
            </a>
            <a onClick={goToSignIn} className="ls-btn ls-btn-primary">
              Get started
            </a>
          </div>
        </div>
      </nav>

      <header className="ls-hero">
        <div className="ls-shell ls-hero-grid">
          <div>
            <span className="ls-eyebrow">Voice-first fluid tracking</span>
            <h1>
              Say what you drank.
              <br />
              Know what's <em>real</em>.
            </h1>
            <p className="ls-sub">
              FluidSense logs intake and output the moment you speak it — then
              holds every entry to one honest line: measured, estimated, or
              unknown. Never blurred into a single confident number.
            </p>
            <div className="ls-ctas">
              <a onClick={goToSignIn} className="ls-btn ls-btn-primary">
                Get started free
              </a>
              <a href="#how" className="ls-btn ls-btn-ghost">
                See how it works ↓
              </a>
            </div>
            <p className="ls-fineprint">
              No card required · Works fully offline on your device · Built for
              patients, carers, and care teams
            </p>
          </div>

          <div className="ls-ripple-stage">
            <canvas
              ref={canvasRef}
              width={640}
              height={640}
              role="img"
              aria-label="Animated concentric rings representing measured, container-estimated, approximate, and unmeasured fluid entries"
            />
            <div className="ls-ripple-legend">
              <div className="ls-row">
                <span
                  className="ls-swatch"
                  style={{ background: "var(--confidence-mint)" }}
                />{" "}
                Measured — exact volume recorded
              </div>
              <div className="ls-row">
                <span
                  className="ls-swatch"
                  style={{ background: "var(--accent-intake)", opacity: 0.75 }}
                />{" "}
                Container estimate — known vessel, partial fill
              </div>
              <div className="ls-row">
                <span
                  className="ls-swatch"
                  style={{ background: "var(--confidence-amber)" }}
                />{" "}
                Approximate — a guided guess
              </div>
              <div className="ls-row">
                <span
                  className="ls-swatch"
                  style={{ background: "var(--ink-faint)", opacity: 0.5 }}
                />{" "}
                Unmeasured — logged, not quantified
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="ls-problem">
        <div className="ls-shell">
          <div className="ls-problem-grid">
            <div className="ls-problem-cell">
              <div className="ls-stat ls-warn">73%</div>
              <p>
                of paper fluid balance charts contain at least one estimated
                entry recorded as if it were exact — the gap that causes over-
                or under-correction downstream.
              </p>
            </div>
            <div className="ls-problem-cell">
              <div className="ls-stat">&lt;10s</div>
              <p>
                to log a drink by voice — "I finished my 500 mL bottle of water"
                becomes a structured, confirmed entry before you've put your
                glass down.
              </p>
            </div>
            <div className="ls-problem-cell">
              <div
                className="ls-stat"
                style={{ color: "var(--confidence-mint)" }}
              >
                4
              </div>
              <p>
                measurement statuses, never collapsed into one. A guess stays
                visibly a guess, everywhere it appears — on screen, in charts,
                in exports.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="ls-section" id="how">
        <div className="ls-shell">
          <div className="ls-section-head">
            <div className="ls-kicker">How it works</div>
            <h2>Three steps. Nothing saved without your say-so.</h2>
            <p>
              Every voice entry ends at a confirmation screen you can edit or
              cancel — never wired to save automatically, no matter how
              confident the transcript sounds.
            </p>
          </div>
          <div className="ls-steps">
            <div className="ls-step">
              <div className="ls-mock-card">
                <div className="ls-mock-mic">
                  <span className="ls-mock-pulse" /> Listening…
                </div>
                <p className="ls-mock-transcript">
                  "I drank about half a mug of tea, and passed 300 mL of urine."
                </p>
              </div>
              <div>
                <div className="ls-tag">01 — Speak it</div>
                <h3>Talk naturally, mid-task</h3>
                <p>
                  No forms, no unit conversions in your head. Spoken numbers,
                  container fractions, and multi-part sentences are all
                  understood as you'd actually say them.
                </p>
              </div>
            </div>
            <div className="ls-step">
              <div className="ls-mock-card">
                <div className="ls-mock-confirm-row">
                  <span>Tea, half mug</span>
                  <span
                    className="ls-mock-badge"
                    style={{
                      background: "var(--confidence-amber-soft)",
                      color: "var(--confidence-amber)",
                    }}
                  >
                    APPROX. 125 mL
                  </span>
                </div>
                <div className="ls-mock-confirm-row">
                  <span>Urine, measured</span>
                  <span
                    className="ls-mock-badge"
                    style={{
                      background: "var(--confidence-mint-soft)",
                      color: "var(--confidence-mint)",
                    }}
                  >
                    300 mL
                  </span>
                </div>
              </div>
              <div>
                <div className="ls-tag">02 — Confirm it</div>
                <h3>Review before anything saves</h3>
                <p>
                  Each detected entry shows its own status and amount, editable
                  independently. Nothing writes to your record until you tap
                  confirm.
                </p>
              </div>
            </div>
            <div className="ls-step">
              <div className="ls-mock-card">
                <div className="ls-mock-balance">
                  <div
                    className="ls-big"
                    style={{ color: "var(--accent-output)" }}
                  >
                    −175 mL
                  </div>
                  <div className="ls-lbl">RECORDED BALANCE · LAST 24H</div>
                </div>
              </div>
              <div>
                <div className="ls-tag">03 — See it</div>
                <h3>A balance that shows its own gaps</h3>
                <p>
                  Totals are shown alongside a reliability read on the record
                  itself — because a balance built from guesses should say so,
                  not just report a number.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className="ls-section"
        id="honesty"
        style={{
          background: "var(--canvas-raised)",
          borderTop: "1px solid var(--line)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div className="ls-shell">
          <div className="ls-section-head">
            <div className="ls-kicker">The core idea</div>
            <h2>Four statuses. Never one blurred number.</h2>
            <p>
              Most tools reduce every entry to a single confident figure.
              FluidSense keeps the distinction visible everywhere — on the
              entry, in the day's total, in anything exported to a care team.
            </p>
          </div>
          <div className="ls-status-grid">
            <div className="ls-status-card">
              <div
                className="ls-status-ring"
                style={{ background: "var(--confidence-mint)" }}
              />
              <h3>Measured</h3>
              <p>
                An exact, recorded volume — from a graduated container, a
                device, or a precise count.
              </p>
            </div>
            <div className="ls-status-card">
              <div
                className="ls-status-ring"
                style={{ background: "var(--accent-intake)", opacity: 0.85 }}
              />
              <h3>Container estimate</h3>
              <p>
                A known vessel's volume, scaled to how full or empty it was —
                close, but not exact.
              </p>
            </div>
            <div className="ls-status-card">
              <div
                className="ls-status-ring"
                style={{ background: "var(--confidence-amber)" }}
              />
              <h3>Approximate</h3>
              <p>
                A guided guess — "about half a mug" — recorded as exactly that,
                not rounded into certainty.
              </p>
            </div>
            <div className="ls-status-card">
              <div
                className="ls-status-ring"
                style={{ background: "var(--ink-faint)", opacity: 0.4 }}
              />
              <h3>Unmeasured</h3>
              <p>
                Something happened and is worth knowing about — even with no
                volume attached at all.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="ls-section" id="who">
        <div className="ls-shell">
          <div className="ls-section-head">
            <div className="ls-kicker">One record, every role</div>
            <h2>
              Patients, carers, and care teams — looking at the same truth.
            </h2>
            <p>
              Patient mode and healthcare mode share one data model. A clinician
              reviewing a chart sees the exact same measurement-status
              distinctions a patient logged at home.
            </p>
          </div>
          <div className="ls-aud-grid">
            <div className="ls-aud-cell">
              <h3>Patients</h3>
              <p>
                Log by voice between sips, no manual math, no app-literacy
                required.
              </p>
            </div>
            <div className="ls-aud-cell">
              <h3>Family carers</h3>
              <p>
                Track on someone else's behalf with the same honesty rules,
                never overstating what was actually seen.
              </p>
            </div>
            <div className="ls-aud-cell">
              <h3>Nurses</h3>
              <p>
                Verify, correct, or flag entries on a ward round — every change
                lands in a visible audit trail.
              </p>
            </div>
            <div className="ls-aud-cell">
              <h3>Clinicians</h3>
              <p>
                Review a caseload's reliability at a glance before trusting a
                single balance figure.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="ls-cta">
        <h2>Start recording the truth, not the tidy version.</h2>
        <p>
          Free to use. Works fully on-device. No clinical claims — just an
          honest record of what was actually seen.
        </p>
        <div className="ls-ctas">
          <a onClick={goToSignIn} className="ls-btn ls-btn-primary">
            Get started free
          </a>
          <a onClick={goToSignIn} className="ls-btn ls-btn-ghost">
            Sign in
          </a>
        </div>
      </div>

      <footer className="ls-footer">
        <div className="ls-shell">
          <div className="ls-foot-row">
            <span>
              FluidSense is a prototype. It is not a certified clinical device.
            </span>
            <div className="ls-foot-links">
              <a onClick={() => navigate("/privacy")}>Privacy</a>
              <a onClick={() => navigate("/terms")}>Terms</a>
              <a href="#how">How it works</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
