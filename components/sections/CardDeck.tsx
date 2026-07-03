"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import {
  ArrowUpRight,
  Network,
  Cloud,
  Globe,
  Wrench,
  Radar,
  type LucideIcon,
} from "lucide-react";
import { navNodes, type NavNode } from "@/content/nav-nodes";

/* Faint line-art watermark behind each card's copy — one glyph per domain. */
const ICONS: Record<string, LucideIcon> = {
  "active-directory": Network,
  "azure-entra": Cloud,
  "hacking-web": Globe,
  tools: Wrench,
  osint: Radar,
};

/* ------------------------------------------------------------------ *
 * Per-domain card look. Kept here (presentation) while the copy stays
 * in content/nav-nodes.ts (content). Each card is a glossy gradient
 * face; `glow` tints the drop shadow of the front card.
 * ------------------------------------------------------------------ */
type Theme = { gradient: string; glow: string };

const THEME: Record<string, Theme> = {
  "active-directory": {
    gradient:
      "linear-gradient(150deg, #9a82ff 0%, #6a3ff0 40%, #2a1a66 100%)",
    glow: "rgba(124,92,255,0.55)",
  },
  "azure-entra": {
    gradient:
      "linear-gradient(150deg, #6aa8ff 0%, #2f6be0 42%, #142a63 100%)",
    glow: "rgba(59,130,246,0.5)",
  },
  "hacking-web": {
    gradient:
      "linear-gradient(150deg, #4fe6f2 0%, #1aa6c8 42%, #0e3350 100%)",
    glow: "rgba(34,211,238,0.5)",
  },
  tools: {
    gradient:
      "linear-gradient(150deg, #b0a3ff 0%, #6357d6 42%, #201b3a 100%)",
    glow: "rgba(157,134,255,0.5)",
  },
  osint: {
    gradient:
      "linear-gradient(150deg, #5ff0c0 0%, #17a883 42%, #0c3a30 100%)",
    glow: "rgba(52,211,153,0.45)",
  },
};

/* Carousel geometry, keyed by distance from the active card (0 = centre).
   The centre card faces the viewer, steps forward (`tz`) and is largest; the
   neighbours tuck behind it, turned nearly edge-on (`ry`) so only a sliver
   peeks out at the sides. `sign` (±1) mirrors the level to left / right. */
type Level = { x: number; ry: number; tz: number; scale: number; op: number; z: number; bright: number };

const CARD_W = 214;
const CARD_H = 362;

const LEVELS: Level[] = [
  { x: 0, ry: 0, tz: 140, scale: 1.14, op: 1, z: 50, bright: 1.06 }, // centre
  { x: 168, ry: 54, tz: -34, scale: 0.9, op: 1, z: 30, bright: 0.78 }, // neighbour
  { x: 278, ry: 68, tz: -168, scale: 0.78, op: 0.5, z: 10, bright: 0.55 }, // far
];

/* Resolve a card's transform from its signed offset to the active card. */
function placeAt(rel: number) {
  const lvl = LEVELS[Math.min(Math.abs(rel), LEVELS.length - 1)];
  const sign = Math.sign(rel);
  return {
    x: sign * lvl.x,
    rotateY: -sign * lvl.ry, // side cards turn their face inward, toward centre
    z: lvl.tz,
    scale: lvl.scale,
    opacity: lvl.op,
    zIndex: lvl.z,
    bright: lvl.bright,
  };
}

/* Shortest signed distance i→active around the ring, so both sides fill. */
function ringRel(i: number, active: number, n: number) {
  let rel = i - active;
  if (rel > n / 2) rel -= n;
  if (rel < -n / 2) rel += n;
  return rel;
}

/* ------------------------------------------------------------------ *
 * The glossy card face — shared by the deck and the mobile list.
 * ------------------------------------------------------------------ */
function CardFace({
  node,
  index,
  front,
  compact = false,
}: {
  node: NavNode;
  index: number;
  front: boolean;
  compact?: boolean;
}) {
  const theme = THEME[node.id] ?? THEME["active-directory"];
  const Icon = ICONS[node.id];
  return (
    <div
      className="relative flex h-full w-full flex-col justify-between overflow-hidden rounded-[26px] border border-white/15"
      style={{
        background: theme.gradient,
        boxShadow: front
          ? `0 44px 100px -34px ${theme.glow}, 0 10px 30px -14px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.28)`
          : "0 20px 50px -24px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.16)",
      }}
    >
      {/* top-left gloss highlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-1/4 -top-1/3 h-2/3 w-2/3 rounded-full blur-2xl"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.55), transparent 62%)",
          opacity: 0.45,
        }}
      />
      {/* faint line-art domain glyph, sitting in the upper-middle of the card */}
      {Icon && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-[26%] flex justify-center"
          style={{ opacity: front ? 0.24 : 0.16 }}
        >
          <Icon
            size={compact ? 84 : 132}
            strokeWidth={1}
            className="text-white transition-opacity duration-300"
          />
        </div>
      )}
      {/* diagonal sheen + bottom shade for depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(125deg, rgba(255,255,255,0.16) 0%, transparent 34%, transparent 66%, rgba(0,0,0,0.28) 100%)",
        }}
      />

      {/* header: badge + faint route handle (or coming-soon flag) */}
      <div className={`relative flex items-start justify-between ${compact ? "p-4" : "p-6"}`}>
        <span className="rounded-full border border-white/20 bg-black/25 px-3 py-1 text-[12px] font-medium text-white backdrop-blur-sm">
          {node.title}
        </span>
        {node.comingSoon ? (
          <span className="font-mono rounded-full border border-white/30 bg-white/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white backdrop-blur-sm">
            Soon
          </span>
        ) : (
          <span className="font-mono select-none text-[10px] tracking-wide text-white/45">
            rpj:{node.href}
          </span>
        )}
      </div>

      {/* footer: big tagline + tags + CTA */}
      <div className={`relative ${compact ? "p-4 pt-0" : "p-6 pt-0"}`}>
        <h3
          className={`font-display font-semibold leading-[1.08] text-white ${
            compact ? "text-xl" : "text-[26px]"
          }`}
          style={{ textShadow: "0 2px 20px rgba(0,0,0,0.35)" }}
        >
          {node.tagline}
        </h3>

        {!compact && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {node.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-[10.5px] font-medium text-white/85"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <span
          className={`mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-white transition-opacity duration-300 ${
            front ? "opacity-100" : "opacity-80"
          }`}
        >
          {node.comingSoon ? (
            <>Coming soon</>
          ) : (
            <>
              Open {node.title}
              <ArrowUpRight size={15} />
            </>
          )}
        </span>
      </div>

      {/* keep depth ordering stable for stacked back cards */}
      <span className="sr-only">{index}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * One card in the carousel. Positioned absolutely at the stage centre;
 * `rel` (signed offset to the active card) drives its 3D slot. The
 * centre card is a link (opens the domain); side cards select on click
 * (rotate the ring to bring themselves to the front).
 * ------------------------------------------------------------------ */
function CarouselCard({
  node,
  index,
  rel,
  onSelect,
}: {
  node: NavNode;
  index: number;
  rel: number;
  onSelect: (i: number) => void;
}) {
  const [hover, setHover] = useState(false);
  const p = placeAt(rel);
  const centre = rel === 0;

  // centre lifts + steps forward on hover; side cards ease toward the viewer
  // to invite a click.
  const face = <CardFace node={node} index={index} front={centre} />;

  return (
    <motion.div
      className="absolute cursor-pointer"
      style={{
        width: CARD_W,
        height: CARD_H,
        left: `calc(50% - ${CARD_W / 2}px)`,
        top: `calc(50% - ${CARD_H / 2}px)`,
        transformStyle: "preserve-3d",
        zIndex: p.zIndex,
        filter: `brightness(${hover ? p.bright + 0.12 : p.bright})`,
      }}
      animate={{
        x: p.x,
        z: centre ? (hover ? p.z + 70 : p.z) : hover ? p.z + 60 : p.z,
        rotateY: p.rotateY,
        scale: centre ? (hover ? p.scale * 1.04 : p.scale) : p.scale,
        opacity: p.opacity,
      }}
      transition={{ type: "spring", stiffness: 90, damping: 18 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {centre ? (
        <Link
          href={node.href}
          aria-label={`Open ${node.title}`}
          className="block h-full w-full outline-none"
        >
          {face}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => onSelect(index)}
          aria-label={`Select ${node.title}`}
          className="block h-full w-full text-left outline-none"
        >
          {face}
        </button>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 * Desktop deck: a floating 3D carousel. One dominant centre card faces
 * the viewer; its neighbours orbit behind, peeking at the sides. The
 * ring auto-advances, the whole system tilts with the pointer, and each
 * card floats subtly. Click a side card to bring it forward; click the
 * centre card to open its domain.
 * ------------------------------------------------------------------ */
export function CardDeck() {
  const reduced = useReducedMotion();
  const n = navNodes.length;
  const [active, setActive] = useState(2); // start centred for symmetric wings
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const pausedRef = useRef(false);

  // auto-advance the ring while idle
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      if (pausedRef.current) return;
      setActive((a) => (a + 1) % n);
    }, 4200);
    return () => clearInterval(id);
  }, [reduced, n]);

  const onMove = (e: React.MouseEvent) => {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: -py * 7, y: px * 12 });
  };

  return (
    <div
      className="relative z-10 hidden w-full justify-center xl:flex"
      style={{ perspective: 1900 }}
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => {
        pausedRef.current = false;
        setTilt({ x: 0, y: 0 });
      }}
      onMouseMove={onMove}
    >
      {/* idle float — the whole system breathes */}
      <motion.div
        className="relative"
        style={{ width: "100%", height: 440, transformStyle: "preserve-3d" }}
        animate={reduced ? undefined : { y: [0, -12, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* pointer tilt — the whole system reacts as one */}
        <motion.div
          className="absolute inset-0"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateX: tilt.x, rotateY: tilt.y }}
          transition={{ type: "spring", stiffness: 80, damping: 16 }}
        >
          {navNodes.map((node, i) => (
            <CarouselCard
              key={node.id}
              node={node}
              index={i}
              rel={ringRel(i, active, n)}
              onSelect={setActive}
            />
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Mobile / < xl fallback: the same gradient cards as a tappable stack.
 * ------------------------------------------------------------------ */
export function CardDeckMobile() {
  return (
    <div className="grid w-full max-w-md gap-4 xl:hidden">
      {navNodes.map((node, i) => (
        <Link
          key={node.id}
          href={node.href}
          aria-label={`${node.title} — Open ${node.title}`}
          className="block h-40"
        >
          <CardFace node={node} index={i} front compact />
        </Link>
      ))}
    </div>
  );
}
