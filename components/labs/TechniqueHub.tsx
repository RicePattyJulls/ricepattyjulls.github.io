"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { DepthCard } from "@/components/ui/DepthCard";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { accentColor, Kicker, KineticHeading } from "@/components/ui/primitives";
import { Section } from "@/components/layout/Section";
import { depthIn, inView, rise, stagger } from "@/lib/motion";

type Technique = {
  title: string;
  summary: readonly string[];
  tags: readonly string[];
  slug: string;
};

type LabSection = {
  key: string;
  title: string;
  description: string;
  tag: string;
};

export type TechniqueHubProps = {
  itemLabel?: string;
  sectionLabel?: string;
  basePath: string;
  kicker: string;
  title: string;
  blurb: string;
  accent: "violet" | "blue" | "cyan" | "danger";
  sections: LabSection[];
  techniquesBySection: Record<string, readonly Technique[]>;
};

function TechniqueCard({
  t,
  href,
  color,
}: {
  t: Technique;
  href: string;
  color: string;
}) {
  return (
    <motion.div variants={depthIn}>
      <DepthCard
        href={href}
        accent={color}
        className="relative h-full p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-[17px] font-semibold leading-snug tracking-tight text-white">
            {t.title}
          </h3>
          <ArrowUpRight
            size={17}
            className="mt-0.5 shrink-0 text-text-mute transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white"
          />
        </div>

        <ul className="mt-4 flex-1 space-y-2">
          {t.summary.map((s) => (
            <li key={s} className="flex gap-2.5 text-[12.5px] leading-relaxed text-text-dim">
              <span
                aria-hidden
                className="mt-[7px] h-1 w-1 shrink-0 rounded-full"
                style={{ background: color }}
              />
              {s}
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-wrap gap-1.5 border-t border-[color:var(--border)] pt-4">
          {t.tags.map((tag) => (
            <span
              key={tag}
              className="font-mono rounded-md border px-2 py-0.5 text-[10px] tracking-wide text-text-mute"
              style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.02)" }}
            >
              {tag}
            </span>
          ))}
        </div>
      </DepthCard>
    </motion.div>
  );
}

export function TechniqueHub({
  itemLabel = "Techniques",
  sectionLabel = "Phases",
  basePath,
  kicker,
  title,
  blurb,
  accent,
  sections,
  techniquesBySection,
}: TechniqueHubProps) {
  const color = accentColor[accent];
  const total = Object.values(techniquesBySection).reduce((n, a) => n + a.length, 0);

  return (
    <Section className="pt-32 pb-20 lg:pt-40">
      {/* header */}
      <motion.div initial="hidden" animate="show" variants={stagger(0, 0.06)}>
        <motion.div variants={rise}>
          <Link
            href="/"
            className="group font-mono inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-text-mute transition-colors hover:text-white"
          >
            <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
            Back to hub
          </Link>
        </motion.div>

        <motion.div variants={rise} className="mt-8">
          <Kicker accent={accent}>{kicker}</Kicker>
        </motion.div>

        <KineticHeading
          text={title}
          as="h1"
          className="font-display mt-4 text-4xl font-semibold tracking-tight sm:text-6xl"
        />

        <motion.p
          variants={rise}
          className="mt-5 max-w-2xl text-[15px] leading-relaxed text-text-dim sm:text-base"
        >
          {blurb}
        </motion.p>

        <motion.div variants={rise} className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
          <div>
            <div className="font-display tabular text-2xl font-semibold" style={{ color }}>
              {total}
            </div>
            <div className="font-mono mt-1 text-[10px] uppercase tracking-[0.16em] text-text-mute">
              {itemLabel}
            </div>
          </div>
          <div>
            <div className="font-display tabular text-2xl font-semibold" style={{ color }}>
              {sections.length}
            </div>
            <div className="font-mono mt-1 text-[10px] uppercase tracking-[0.16em] text-text-mute">
              {sectionLabel}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* section spine */}
      <div className="mt-16 space-y-20">
        {sections.map((s) => {
          const techniques = techniquesBySection[s.key] ?? [];
          if (!techniques.length) return null;
          return (
            <section key={s.key} id={s.key} className="scroll-mt-28">
              <motion.div
                initial="hidden"
                whileInView="show"
                viewport={inView}
                variants={stagger(0, 0.05)}
              >
                <motion.div variants={rise} className="flex items-center gap-3">
                  <span className="hairline w-8" />
                  <span
                    className="font-mono text-[11px] uppercase tracking-[0.22em]"
                    style={{ color }}
                  >
                    {s.tag}
                  </span>
                </motion.div>
                <motion.h2
                  variants={rise}
                  className="font-display mt-3 text-2xl font-semibold tracking-tight sm:text-3xl"
                >
                  {s.title}
                </motion.h2>
                <motion.p
                  variants={rise}
                  className="mt-2 max-w-2xl text-[14px] leading-relaxed text-text-dim"
                >
                  {s.description}
                </motion.p>
              </motion.div>

              <motion.div
                initial="hidden"
                whileInView="show"
                viewport={inView}
                variants={stagger(0.05, 0.06)}
                className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                {techniques.map((t) => (
                  <TechniqueCard
                    key={t.slug}
                    t={t}
                    href={`${basePath}/${t.slug}`}
                    color={color}
                  />
                ))}
              </motion.div>
            </section>
          );
        })}
      </div>
    </Section>
  );
}
