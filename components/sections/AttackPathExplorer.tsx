"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ChevronRight, Crosshair, Radar } from "lucide-react";
import { attackPath, type AttackStage } from "@/content/attack-path";
import { accentColor, Kicker, Tag } from "@/components/ui/primitives";

/* ---- Card content shared by both desktop rail and mobile fallback ---- */
function StageCard({
  stage,
  active,
}: {
  stage: AttackStage;
  active: boolean;
}) {
  const color = accentColor[stage.accent];
  return (
    <div
      className={`panel-strong relative flex h-full flex-col justify-between overflow-hidden rounded-3xl p-7 transition-all duration-500 sm:p-9 ${
        active ? "opacity-100" : "opacity-55"
      }`}
      style={{
        boxShadow: active
          ? `0 30px 80px -30px ${color}, inset 0 1px 0 rgba(255,255,255,0.06)`
          : "inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {/* accent wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl transition-opacity duration-500"
        style={{ background: color, opacity: active ? 0.22 : 0.08 }}
      />
      <div className="relative">
        <div className="mb-6 flex items-center justify-between">
          <span
            className="font-display text-6xl font-semibold leading-none sm:text-7xl"
            style={{ color, opacity: 0.9 }}
          >
            {stage.index}
          </span>
          <span
            className="font-mono rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em]"
            style={{ borderColor: "var(--border-strong)", color: "var(--text-dim)" }}
          >
            {stage.phase}
          </span>
        </div>

        <h3 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {stage.title}
        </h3>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-text-dim sm:text-[15px]">
          {stage.summary}
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {stage.techniques.map((t) => (
            <Tag key={t} accent={stage.accent}>
              {t}
            </Tag>
          ))}
        </div>
      </div>

      <div className="relative mt-7 border-t border-[color:var(--border)] pt-4">
        <div className="font-mono mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-text-mute">
          <Radar size={12} /> Detection surface
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {stage.signals.map((s) => (
            <span key={s} className="text-xs text-text-dim">
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---- Clickable minimap of the kill chain ---- */
function MiniMap({
  active,
  onJump,
}: {
  active: number;
  onJump: (i: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {attackPath.map((s, i) => {
        const color = accentColor[s.accent];
        const on = i <= active;
        return (
          <div key={s.id} className="flex items-center">
            <button
              onClick={() => onJump(i)}
              className="group flex shrink-0 items-center gap-2 rounded-full px-2.5 py-1.5 transition-colors hover:bg-white/5"
              aria-label={`Jump to ${s.phase}`}
            >
              <span
                className="grid h-6 w-6 place-items-center rounded-full border font-mono text-[10px] transition-all"
                style={{
                  borderColor: i === active ? color : "var(--border-strong)",
                  background: on ? color : "transparent",
                  color: on ? "#0a0b12" : "var(--text-mute)",
                  boxShadow: i === active ? `0 0 16px -2px ${color}` : "none",
                }}
              >
                {s.index}
              </span>
              <span
                className={`font-mono hidden text-[11px] tracking-wide transition-colors md:inline ${
                  i === active ? "text-white" : "text-text-mute"
                }`}
              >
                {s.phase}
              </span>
            </button>
            {i < attackPath.length - 1 && (
              <ChevronRight size={14} className="shrink-0 text-text-mute" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AttackPathExplorer() {
  const reduced = useReducedMotion();
  const [isDesktop, setIsDesktop] = useState(false);
  const [active, setActive] = useState(0);

  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pinTrigger = useRef<ScrollTrigger | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setIsDesktop(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const useIsomorphic =
    typeof window !== "undefined" ? useLayoutEffect : useEffect;

  useIsomorphic(() => {
    if (!isDesktop || reduced) return;
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return;

    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      const distance = () => track.scrollWidth - window.innerWidth * 0.72;

      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: "none",
      });

      pinTrigger.current = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: () => "+=" + distance(),
        pin: true,
        scrub: 1,
        animation: tween,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const i = Math.round(self.progress * (attackPath.length - 1));
          setActive((prev) => (prev !== i ? i : prev));
        },
      });
    }, section);

    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh);

    return () => {
      window.removeEventListener("load", refresh);
      ctx.revert();
      pinTrigger.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop, reduced]);

  const jump = (i: number) => {
    const st = pinTrigger.current;
    if (!st) return;
    const p = i / (attackPath.length - 1);
    const top = st.start + p * (st.end - st.start);
    window.scrollTo({ top, behavior: "smooth" });
  };

  // ---- Mobile / reduced-motion fallback: vertical stepper ----
  if (!isDesktop || reduced) {
    return (
      <section id="attack-path" className="relative py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Header />
          <div className="mt-12 flex flex-col gap-5">
            {attackPath.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-10% 0px" }}
                transition={{ duration: 0.5, delay: (i % 2) * 0.05 }}
                className="min-h-[320px]"
              >
                <StageCard stage={s} active />
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // ---- Desktop: pinned horizontal rail ----
  return (
    <section id="attack-path" ref={sectionRef} className="relative">
      <div className="flex h-screen flex-col justify-center overflow-hidden">
        <div className="mx-auto w-full max-w-6xl px-8 pt-8">
          <Header />
          <div className="mt-6">
            <MiniMap active={active} onJump={jump} />
            <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-white/5">
              <motion.div
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, var(--violet), var(--cyan))" }}
                animate={{
                  width: `${(active / (attackPath.length - 1)) * 100}%`,
                }}
                transition={{ ease: "easeOut", duration: 0.4 }}
              />
            </div>
          </div>
        </div>

        <div
          ref={trackRef}
          className="mt-8 flex items-stretch gap-6 pl-8 pr-[40vw] will-change-transform"
        >
          {attackPath.map((s, i) => (
            <div
              key={s.id}
              className="h-[52vh] w-[68vw] shrink-0 sm:w-[46vw] lg:w-[30vw] xl:w-[26vw]"
            >
              <StageCard stage={s} active={i === active} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Header() {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <Kicker accent="violet">
          <Crosshair size={12} /> Attack Path Explorer
        </Kicker>
        <h2 className="font-display mt-3 max-w-xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          One narrative, seven stages, zero assumptions
        </h2>
      </div>
      <p className="max-w-sm text-sm leading-relaxed text-text-dim">
        Follow the full kill chain the way it actually unfolds in an authorized
        engagement — from a zero-knowledge start to a report that closes it.
      </p>
    </div>
  );
}
