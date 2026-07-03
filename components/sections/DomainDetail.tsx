"use client";

import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { accentColor, Kicker, KineticHeading, Tag } from "@/components/ui/primitives";
import { Section } from "@/components/layout/Section";
import { depthIn, inView, rise, stagger } from "@/lib/motion";

export type DomainDetailData = {
  kicker: string;
  title: string;
  blurb: string;
  accent: "violet" | "blue" | "cyan";
  tags?: string[];
  capabilities: { label: string; detail: string }[];
  metrics?: { value: string; label: string }[];
};

export function DomainDetail({ data }: { data: DomainDetailData }) {
  const color = accentColor[data.accent];

  return (
    <Section className="pt-32 pb-16 lg:pt-40">
      {/* back to hub */}
      <motion.div initial="hidden" animate="show" variants={stagger(0, 0.06)}>
        <motion.div variants={rise}>
          <Link
            href="/"
            className="group font-mono inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-text-mute transition-colors hover:text-white"
          >
            <ArrowLeft
              size={14}
              className="transition-transform group-hover:-translate-x-0.5"
            />
            Back to hub
          </Link>
        </motion.div>

        <motion.div variants={rise} className="mt-8">
          <Kicker accent={data.accent}>{data.kicker}</Kicker>
        </motion.div>

        <KineticHeading
          text={data.title}
          as="h1"
          className="font-display mt-4 text-4xl font-semibold tracking-tight sm:text-6xl"
        />

        <motion.p
          variants={rise}
          className="mt-5 max-w-2xl text-[15px] leading-relaxed text-text-dim sm:text-base"
        >
          {data.blurb}
        </motion.p>

        {data.tags && data.tags.length > 0 && (
          <motion.div variants={rise} className="mt-6 flex flex-wrap gap-2">
            {data.tags.map((t) => (
              <Tag key={t} accent={data.accent}>
                {t}
              </Tag>
            ))}
          </motion.div>
        )}

        {data.metrics && data.metrics.length > 0 && (
          <motion.div variants={rise} className="mt-10 flex flex-wrap gap-x-10 gap-y-6">
            {data.metrics.map((m) => (
              <div key={m.label}>
                <div
                  className="font-display tabular text-3xl font-semibold"
                  style={{ color }}
                >
                  {m.value}
                </div>
                <div className="font-mono mt-1 text-[10px] uppercase tracking-[0.16em] text-text-mute">
                  {m.label}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </motion.div>

      {/* capability grid */}
      <motion.div
        variants={stagger(0.05, 0.07)}
        initial="hidden"
        whileInView="show"
        viewport={inView}
        className="mt-14 grid gap-4 sm:grid-cols-2"
      >
        {data.capabilities.map((c) => (
          <motion.div
            key={c.label}
            variants={depthIn}
            whileHover={{ y: -4 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="panel-strong group relative overflow-hidden p-6"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-10 -z-10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-25"
              style={{ background: `radial-gradient(circle at 50% 0%, ${color}, transparent 70%)` }}
            />
            <div
              className="mb-4 h-9 w-9 rounded-lg border"
              style={{
                borderColor: "var(--border-strong)",
                background: `radial-gradient(circle at 30% 30%, ${color}55, transparent 70%)`,
              }}
            />
            <div className="text-[15px] font-semibold text-white">{c.label}</div>
            <div className="mt-1.5 text-[13px] leading-relaxed text-text-dim">
              {c.detail}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* CTA */}
      <motion.div
        variants={rise}
        initial="hidden"
        whileInView="show"
        viewport={inView}
        className="mt-12"
      >
        <Link
          href="#contact"
          className="group inline-flex items-center gap-2 text-sm font-medium text-white"
        >
          Request an engagement
          <ArrowRight
            size={16}
            className="transition-transform group-hover:translate-x-1"
            style={{ color }}
          />
        </Link>
      </motion.div>
    </Section>
  );
}
