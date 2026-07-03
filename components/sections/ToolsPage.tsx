"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Terminal } from "lucide-react";
import { accentColor, Kicker } from "@/components/ui/primitives";
import { Section } from "@/components/layout/Section";
import { depthIn, inView, rise, stagger } from "@/lib/motion";
import { toolsMeta, toolkits, type ToolkitGroup } from "@/content/tools";

function ToolkitBlock({ group }: { group: ToolkitGroup }) {
  const color = accentColor[group.accent];
  return (
    <section className="scroll-mt-28">
      <motion.div initial="hidden" whileInView="show" viewport={inView} variants={stagger(0, 0.05)}>
        <motion.div variants={rise} className="flex flex-wrap items-center gap-3">
          <span className="hairline w-8" />
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            {group.name}
          </h2>
          <span
            className="font-mono rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]"
            style={{ borderColor: "var(--border-strong)", color }}
          >
            {group.lang}
          </span>
        </motion.div>
        <motion.p variants={rise} className="mt-3 max-w-2xl text-[14px] leading-relaxed text-text-dim">
          {group.description}
        </motion.p>
        <motion.a
          variants={rise}
          href={group.href}
          target="_blank"
          rel="noopener noreferrer"
          className="group mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium"
          style={{ color }}
        >
          Browse on GitHub
          <ArrowUpRight size={14} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </motion.a>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={inView}
        variants={stagger(0.05, 0.06)}
        className="mt-7 grid gap-4 sm:grid-cols-2"
      >
        {group.tools.map((t) => (
          <motion.a
            key={t.name}
            variants={depthIn}
            href={t.href}
            target="_blank"
            rel="noopener noreferrer"
            className="panel-strong group relative flex flex-col overflow-hidden p-5 transition-transform duration-300 hover:-translate-y-1"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-12 -z-10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-20"
              style={{ background: `radial-gradient(circle at 50% 0%, ${color}, transparent 70%)` }}
            />
            <div className="flex items-start justify-between gap-3">
              <span className="font-mono text-[13.5px] font-medium text-white">{t.name}</span>
              <ArrowUpRight
                size={16}
                className="mt-0.5 shrink-0 text-text-mute transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white"
              />
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-text-dim">{t.detail}</p>
          </motion.a>
        ))}
      </motion.div>
    </section>
  );
}

export function ToolsPage() {
  return (
    <Section className="pt-32 pb-20 lg:pt-40">
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
          <Kicker accent="violet">
            <Terminal size={12} /> {toolsMeta.kicker}
          </Kicker>
        </motion.div>

        <motion.h1
          variants={rise}
          className="font-display mt-4 text-4xl font-semibold tracking-tight sm:text-6xl"
        >
          {toolsMeta.title}
        </motion.h1>

        <motion.p
          variants={rise}
          className="mt-5 max-w-2xl text-[15px] leading-relaxed text-text-dim sm:text-base"
        >
          {toolsMeta.blurb}
        </motion.p>

        <motion.a
          variants={rise}
          href={toolsMeta.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-7 inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/[0.04]"
          style={{ borderColor: "var(--border-strong)" }}
        >
          <Terminal size={15} /> View the repository
          <ArrowUpRight size={15} />
        </motion.a>
      </motion.div>

      <div className="mt-16 space-y-20">
        {toolkits.map((g) => (
          <ToolkitBlock key={g.name} group={g} />
        ))}
      </div>
    </Section>
  );
}
