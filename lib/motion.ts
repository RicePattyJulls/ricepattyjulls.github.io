import type { Variants, Transition } from "framer-motion";

/* Single source of motion rhythm — every animation shares these tokens. */

export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
export const EASE_IN_OUT = [0.76, 0, 0.24, 1] as const;

export const DUR = {
  fast: 0.28,
  base: 0.42,
  slow: 0.64,
} as const;

export const spring: Transition = {
  type: "spring",
  stiffness: 120,
  damping: 20,
  mass: 0.9,
};

/* Rise + de-blur reveal — the kinetic-type signature. */
export const rise: Variants = {
  hidden: { opacity: 0, y: 28, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: DUR.base, ease: EASE_OUT_EXPO },
  },
};

/* Panels entering from Z-depth with a slight tilt. */
export const depthIn: Variants = {
  hidden: { opacity: 0, y: 48, scale: 0.96, rotateX: 6 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    transition: { duration: DUR.slow, ease: EASE_OUT_EXPO },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DUR.base, ease: EASE_OUT_EXPO } },
};

/* Stagger container: children reveal 40ms apart. */
export const stagger = (delay = 0, step = 0.06): Variants => ({
  hidden: {},
  show: {
    transition: { staggerChildren: step, delayChildren: delay },
  },
});

/* Shared viewport trigger — reveal once, a bit before fully on-screen. */
export const inView = {
  once: true,
  margin: "-12% 0px -12% 0px",
} as const;
