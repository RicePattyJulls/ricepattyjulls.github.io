"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { DepthCard } from "@/components/ui/DepthCard";
import { ArrowUpRight, ShieldAlert } from "lucide-react";
import { Kicker, KineticHeading } from "@/components/ui/primitives";
import { Section } from "@/components/layout/Section";
import { inView, rise, stagger } from "@/lib/motion";
import { attackChains } from "@/content/attack-chains";

/* The flagship offering: real, black-box-to-tenant engagements, reported and
   sanitized. Deliberately NOT a card in the hero deck — it gets its own
   spotlight panel, first in line after Methodology. */
export function AttackChains() {
  const featured = attackChains[0];

  return (
    <Section id="attack-chains" className="py-24">
      <motion.div
        variants={stagger(0, 0.08)}
        initial="hidden"
        whileInView="show"
        viewport={inView}
        className="panel-strong relative overflow-hidden rounded-[32px] px-6 py-14 sm:px-12 sm:py-16"
        style={{ borderColor: "rgba(244,63,94,0.35)" }}
      >
        {/* crimson bloom — this is the one section where the critical accent leads */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(244,63,94,0.35), transparent 70%)" }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, var(--danger), transparent)" }}
        />

        <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <motion.div variants={rise}>
              <Kicker accent="danger">
                <ShieldAlert size={12} /> Signature Engagement
              </Kicker>
            </motion.div>
            <KineticHeading
              text="Black-box to full tenant compromise"
              className="font-display mt-3 max-w-xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
            />
          </div>
          <motion.p variants={rise} className="max-w-sm text-sm leading-relaxed text-text-dim">
            Real engagements, reported responsibly and sanitized for publication —
            no live domains, tokens, or credentials. This is the offer: proving
            what a real adversary reaches, end to end.
          </motion.p>
        </div>

        <motion.div variants={rise} className="relative mt-10">
          <DepthCard
            href={`/attack-chains/${featured.slug}`}
            accent="#fb7185"
            className="p-6 sm:p-8 [&_.depth-card__content]:gap-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-mute">
                  {featured.eyebrow}
                </span>
                <h3 className="font-display mt-2 text-xl font-semibold text-white sm:text-2xl">
                  {featured.title}
                </h3>
              </div>
              <ArrowUpRight
                size={20}
                className="mt-1 shrink-0 text-text-mute transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white"
              />
            </div>
            <p className="max-w-2xl text-[14px] leading-relaxed text-text-dim">
              {featured.description}
            </p>
            <div className="flex flex-wrap gap-1.5 border-t border-[color:var(--border)] pt-4">
              {featured.tags.map((tag) => (
                <span
                  key={tag}
                  className="font-mono rounded-md border px-2 py-0.5 text-[10px] tracking-wide text-text-mute"
                  style={{ borderColor: "var(--border)" }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </DepthCard>
        </motion.div>

        <motion.div variants={rise} className="relative mt-6 flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-mute">
            First in an ongoing series
          </span>
          <Link
            href="/attack-chains"
            className="font-mono inline-flex items-center gap-1.5 text-[12px] text-text-dim transition-colors hover:text-white"
          >
            View all attack chains <ArrowUpRight size={14} />
          </Link>
        </motion.div>
      </motion.div>
    </Section>
  );
}
