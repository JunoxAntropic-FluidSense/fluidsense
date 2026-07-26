// Scroll-triggered reveal wrapper for landing-page text blocks — fades and
// lifts content in as it enters the viewport. Respects the app's own
// useReducedMotion() (framer-motion animates via WAAPI/inline transforms, so
// it ignores the CSS-only `.reduce-motion` toggle — see that hook's own
// comment), collapsing to an instant, static reveal when set.
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useReducedMotion } from "../../hooks/useReducedMotion";

export function Reveal({
  children,
  delay = 0,
  className = "",
  y = 24,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.2, 0.7, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
