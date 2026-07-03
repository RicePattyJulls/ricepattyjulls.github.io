"use client";

import { motion } from "framer-motion";
import { CardDeck, CardDeckMobile } from "@/components/sections/CardDeck";

export function Hero() {
  return (
    <div
      id="top"
      className="relative flex min-h-[100svh] flex-col items-center justify-center gap-10 overflow-hidden px-5 pt-28 pb-12"
    >
      {/* dim the starfield so the cards read as the subject */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "rgba(5,6,10,0.55)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 55% at 50% 50%, rgba(5,6,10,0.35), transparent 70%)",
        }}
      />

      {/* positioning — who / specialty / what problem */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        className="relative z-10 flex max-w-3xl flex-col items-center text-center"
      >
        <span className="font-mono inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-text-dim">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--violet)", boxShadow: "0 0 10px var(--violet)" }}
          />
          RicePattyJulls · Red Team Operator
        </span>
        <p className="mt-5 text-balance text-lg leading-relaxed text-text-dim sm:text-xl">
          I focus on{" "}
          <span className="text-white">offensive security</span>,{" "}
          <span className="text-white">adversary emulation</span> and{" "}
          <span className="text-white">identity-driven attack paths</span> across
          Web, Active Directory and Cloud environments.
        </p>
      </motion.div>

      {/* Desktop: the fanned deck of domain cards. */}
      <CardDeck />

      {/* Mobile fallback (no hover): the same cards as a tappable stack. */}
      <div className="relative z-10 flex w-full justify-center xl:hidden">
        <CardDeckMobile />
      </div>
    </div>
  );
}
