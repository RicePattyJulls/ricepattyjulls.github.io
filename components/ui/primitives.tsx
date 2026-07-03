"use client";

import { motion } from "framer-motion";
import { useRef, useState, type ReactNode } from "react";
import { rise } from "@/lib/motion";

type Accent = "violet" | "blue" | "cyan" | "danger";

const accentColor: Record<Accent, string> = {
  violet: "var(--violet)",
  blue: "var(--blue)",
  cyan: "var(--cyan)",
  danger: "var(--danger)",
};

/* ---- Mono kicker / eyebrow ---- */
export function Kicker({
  children,
  accent = "violet",
}: {
  children: ReactNode;
  accent?: Accent;
}) {
  return (
    <span
      className="font-mono inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-text-dim"
      style={{ color: "var(--text-dim)" }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: accentColor[accent], boxShadow: `0 0 10px ${accentColor[accent]}` }}
      />
      {children}
    </span>
  );
}

/* ---- Technique / meta tag ---- */
export function Tag({
  children,
  accent = "violet",
}: {
  children: ReactNode;
  accent?: Accent;
}) {
  return (
    <span
      className="font-mono rounded-md border px-2.5 py-1 text-[11px] tracking-wide"
      style={{
        borderColor: "var(--border-strong)",
        color: "var(--text-dim)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <span style={{ color: accentColor[accent] }}>·</span> {children}
    </span>
  );
}

/* ---- Kinetic heading: word-by-word rise + de-blur ---- */
export function KineticHeading({
  text,
  className = "",
  as = "h2",
}: {
  text: string;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  const words = text.split(" ");
  const MotionTag = motion[as];
  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ staggerChildren: 0.07 }}
      aria-label={text}
    >
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom">
          <motion.span
            className="inline-block"
            variants={rise}
            aria-hidden
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </MotionTag>
  );
}

/* ---- Magnetic button ---- */
export function MagneticButton({
  children,
  href,
  variant = "primary",
}: {
  children: ReactNode;
  href: string;
  variant?: "primary" | "ghost";
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [t, setT] = useState({ x: 0, y: 0 });

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setT({
      x: (e.clientX - (r.left + r.width / 2)) * 0.25,
      y: (e.clientY - (r.top + r.height / 2)) * 0.35,
    });
  };

  const base =
    "relative inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium cursor-pointer select-none transition-colors";
  const styles =
    variant === "primary"
      ? "text-white"
      : "text-text-dim hover:text-white border border-[color:var(--border-strong)]";

  return (
    <motion.a
      ref={ref}
      href={href}
      onMouseMove={onMove}
      onMouseLeave={() => setT({ x: 0, y: 0 })}
      animate={{ x: t.x, y: t.y }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
      className={`${base} ${styles}`}
      style={
        variant === "primary"
          ? {
              background:
                "linear-gradient(135deg, var(--violet), var(--blue))",
              boxShadow: "0 12px 40px -12px rgba(124,92,255,0.7)",
            }
          : undefined
      }
    >
      {children}
    </motion.a>
  );
}

/* ---- Floating 2.5D panel with pointer tilt ---- */
export function TiltPanel({
  children,
  className = "",
  accent,
  tilt = true,
}: {
  children: ReactNode;
  className?: string;
  accent?: Accent;
  tilt?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [r, setR] = useState({ x: 0, y: 0 });

  const onMove = (e: React.MouseEvent) => {
    if (!tilt) return;
    const el = ref.current;
    if (!el) return;
    const b = el.getBoundingClientRect();
    const px = (e.clientX - b.left) / b.width - 0.5;
    const py = (e.clientY - b.top) / b.height - 0.5;
    setR({ x: -py * 6, y: px * 8 });
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => setR({ x: 0, y: 0 })}
      animate={{ rotateX: r.x, rotateY: r.y }}
      transition={{ type: "spring", stiffness: 150, damping: 18 }}
      style={{ transformStyle: "preserve-3d", perspective: 1000 }}
      className={`panel-strong ${accent ? "edge-violet" : ""} ${className}`}
    >
      {children}
    </motion.div>
  );
}

export { accentColor };
