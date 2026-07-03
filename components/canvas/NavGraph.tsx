"use client";

import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useAnimationFrame,
} from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { navNodes, type NavNode } from "@/content/nav-nodes";
import { accentColor } from "@/components/ui/primitives";
import { EASE_OUT_EXPO } from "@/lib/motion";

/* Starting orbit angles (deg) — a diamond around the core.
   AD top-left · Azure top-right · Web bottom-left · Tools bottom-right.
   (Screen space: 0°=right, angle increases clockwise since y points down.) */
const INITIAL_ANGLES = [225, 315, 135, 45].map((d) => (d * Math.PI) / 180);
const ORBIT_SPEED = 0.16; // rad/s — one slow revolution ≈ 40s

type Side = "left" | "right";

/* ------------------------------------------------------------------ *
 * Premium glass tooltip — the on-hover summary of a domain.
 * Uses the same dark card color as the case-study cards (panel-strong).
 * ------------------------------------------------------------------ */
function NodeTooltip({ node, side }: { node: NavNode; side: Side }) {
  const color = accentColor[node.accent];
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96, filter: reduced ? "none" : "blur(6px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: 6, scale: 0.97, transition: { duration: 0.15 } }}
      transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
      className="pointer-events-none absolute top-1/2 z-30 w-80 -translate-y-1/2"
      style={side === "right" ? { left: "2rem" } : { right: "2rem" }}
    >
      <div
        className="panel-strong relative overflow-hidden p-5"
        style={{
          boxShadow: `0 28px 70px -28px ${color}, inset 0 1px 0 rgba(255,255,255,0.05)`,
        }}
      >
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 left-1/2 h-32 w-40 -translate-x-1/2 opacity-25 blur-3xl"
          style={{ background: `radial-gradient(circle, ${color}, transparent 70%)` }}
        />

        <div className="relative flex items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: color, boxShadow: `0 0 10px ${color}` }}
          />
          <span className="font-display text-base font-semibold text-white">
            {node.title}
          </span>
        </div>

        <p className="relative mt-2 text-[12.5px] leading-relaxed text-text-dim">
          {node.description}
        </p>

        <ul className="relative mt-4 space-y-2.5 border-t border-[color:var(--border)] pt-4">
          {node.capabilities.map((c) => (
            <li key={c.label} className="flex gap-2.5">
              <span
                aria-hidden
                className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: color }}
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium leading-snug text-white">
                  {c.label}
                </span>
                <span className="block text-[11.5px] leading-snug text-text-mute">
                  {c.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <div
          className="relative mt-4 flex items-center gap-1.5 border-t border-[color:var(--border)] pt-4 text-[13px] font-medium"
          style={{ color }}
        >
          {node.cta}
          <ArrowRight size={14} />
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 * A single orbiting node: glowing dot + label. The parent drives its
 * position each frame via the forwarded ref (transform on the <a>).
 * ------------------------------------------------------------------ */
const Node = forwardRef<
  HTMLAnchorElement,
  {
    node: NavNode;
    active: boolean;
    side: Side;
    onEnter: () => void;
    onLeave: () => void;
  }
>(function Node({ node, active, side, onEnter, onLeave }, ref) {
  const color = accentColor[node.accent];
  const reduced = useReducedMotion();

  return (
    <Link
      ref={ref}
      href={node.href}
      aria-label={`${node.title} — ${node.cta}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      className="group pointer-events-auto absolute left-0 top-0 block cursor-pointer p-3 outline-none"
    >
      {/* pulse + core dot */}
      <span className="relative block h-3.5 w-3.5">
        {!reduced && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: color }}
            animate={{ scale: [1, 2.6], opacity: [0.45, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <span
          aria-hidden
          className="absolute inset-[-7px] rounded-full opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-80 group-focus-visible:opacity-80"
          style={{ background: color }}
        />
        <span
          className="absolute inset-0 rounded-full transition-transform duration-300 group-hover:scale-[1.5] group-focus-visible:scale-[1.5]"
          style={{
            background: `radial-gradient(circle at 35% 30%, #fff, ${color} 62%)`,
            boxShadow: `0 0 12px ${color}, 0 0 30px ${color}`,
          }}
        />
      </span>

      {/* always-on label under the dot — carries a shadow to stay legible
          over the glowing particle core */}
      <span
        className="font-mono pointer-events-none absolute left-1/2 top-full -translate-x-1/2 whitespace-nowrap text-[10.5px] uppercase tracking-[0.2em] text-text-dim transition-colors duration-300 group-hover:text-white group-focus-visible:text-white"
        style={{ textShadow: "0 1px 10px rgba(3,4,8,0.95), 0 0 24px rgba(3,4,8,0.85)" }}
      >
        {node.title}
      </span>

      <AnimatePresence>
        {active && <NodeTooltip node={node} side={side} />}
      </AnimatePresence>
    </Link>
  );
});

/* ------------------------------------------------------------------ *
 * Desktop hub: the 4 domain nodes orbit the WebGL core. Hovering a node
 * freezes just that one and reveals its summary; leaving resumes its orbit.
 * Non-blocking overlay — only the nodes capture pointer events.
 * ------------------------------------------------------------------ */
export function NavGraph() {
  const reduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const anglesRef = useRef<number[]>([...INITIAL_ANGLES]);
  const geom = useRef({ cx: 0, cy: 0, r: 200 });
  const activeRef = useRef<string | null>(null);

  const [active, setActive] = useState<{ id: string; side: Side } | null>(null);
  const [ringR, setRingR] = useState(0);

  useEffect(() => {
    activeRef.current = active?.id ?? null;
  }, [active]);

  const place = (i: number, a: number) => {
    const el = nodeRefs.current[i];
    if (!el) return;
    const { cx, cy, r } = geom.current;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    el.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 50%))`;
  };

  // measure + place before paint so nodes never flash at (0,0)
  useLayoutEffect(() => {
    const measure = () => {
      const el = containerRef.current;
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      const r = Math.min(w, h) * 0.26;
      geom.current = { cx: w / 2, cy: h / 2, r };
      setRingR(r);
      navNodes.forEach((_, i) => place(i, anglesRef.current[i]));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
     
  }, []);

  useAnimationFrame((_, delta) => {
    const dt = Math.min(delta, 64) / 1000; // clamp on tab refocus
    for (let i = 0; i < navNodes.length; i++) {
      if (!reduced && activeRef.current !== navNodes[i].id) {
        anglesRef.current[i] += dt * ORBIT_SPEED;
      }
      place(i, anglesRef.current[i]);
    }
  });

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-10 hidden xl:block"
    >
      {/* faint orbit path the nodes ride along */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        <circle
          cx="50%"
          cy="50%"
          r={ringR}
          fill="none"
          stroke="rgba(180,168,255,0.10)"
          strokeWidth={1}
          strokeDasharray="2 7"
        />
      </svg>

      {navNodes.map((n, i) => (
        <Node
          key={n.id}
          node={n}
          ref={(el) => {
            nodeRefs.current[i] = el;
          }}
          active={active?.id === n.id}
          side={active?.id === n.id ? active.side : "right"}
          onEnter={() =>
            setActive({
              id: n.id,
              side: Math.cos(anglesRef.current[i]) >= 0 ? "right" : "left",
            })
          }
          onLeave={() => setActive((p) => (p?.id === n.id ? null : p))}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Fallback for < xl viewports where the orbit hover can't work:
 * the same domain info as stacked cards (title + what you can find + CTA).
 * ------------------------------------------------------------------ */
export function NavNodesMobile() {
  return (
    <div className="mt-10 grid w-full max-w-md gap-3 xl:hidden">
      {navNodes.map((n) => {
        const color = accentColor[n.accent];
        return (
          <Link
            key={n.id}
            href={n.href}
            className="panel-strong group relative overflow-hidden p-5 text-left"
          >
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-px"
              style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
            />
            <span className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: color, boxShadow: `0 0 10px ${color}` }}
              />
              <span className="font-display text-[15px] font-semibold text-white">
                {n.title}
              </span>
            </span>

            <p className="mt-2 text-[12.5px] leading-relaxed text-text-dim">
              {n.description}
            </p>

            <ul className="mt-3.5 space-y-2 border-t border-[color:var(--border)] pt-3.5">
              {n.capabilities.map((c) => (
                <li key={c.label} className="flex gap-2.5">
                  <span
                    aria-hidden
                    className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: color }}
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium leading-snug text-white">
                      {c.label}
                    </span>
                    <span className="block text-[11.5px] leading-snug text-text-mute">
                      {c.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <span
              className="mt-4 flex items-center gap-1.5 border-t border-[color:var(--border)] pt-4 text-[13px] font-medium"
              style={{ color }}
            >
              {n.cta}
              <ArrowRight
                size={13}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </span>
          </Link>
        );
      })}
    </div>
  );
}
