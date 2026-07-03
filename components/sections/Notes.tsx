"use client";

import { motion } from "framer-motion";
import { BookOpen, ArrowUpRight } from "lucide-react";
import { notes } from "@/content/site";
import { Kicker } from "@/components/ui/primitives";
import { Section } from "@/components/layout/Section";
import { inView, stagger } from "@/lib/motion";

export function Notes() {
  return (
    <Section id="notes" className="py-24">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Kicker accent="blue">
            <BookOpen size={12} /> Field Notes
          </Kicker>
          <h2 className="font-display mt-3 max-w-xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Working notes from the knowledge base
          </h2>
        </div>
        <a
          href="#notes"
          className="group inline-flex items-center gap-2 self-start text-sm font-medium text-text-dim hover:text-white"
        >
          Browse all notes
          <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        </a>
      </div>

      <motion.div
        variants={stagger(0.05, 0.07)}
        initial="hidden"
        whileInView="show"
        viewport={inView}
        className="mt-12 grid gap-4 sm:grid-cols-2"
      >
        {notes.map((n) => (
          <motion.a
            key={n.id}
            href="#notes"
            variants={{
              hidden: { opacity: 0, y: 24 },
              show: { opacity: 1, y: 0, transition: { duration: 0.45 } },
            }}
            whileHover={{ y: -4 }}
            className="group panel relative flex items-start justify-between gap-6 overflow-hidden p-6"
          >
            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-violet-soft">
                {n.tag}
              </span>
              <h3 className="font-display mt-2 text-lg font-semibold leading-snug tracking-tight group-hover:text-white">
                {n.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-text-dim">
                {n.excerpt}
              </p>
              <span className="font-mono mt-4 inline-block text-[11px] text-text-mute">
                {n.readTime} read
              </span>
            </div>
            <ArrowUpRight
              size={18}
              className="mt-1 shrink-0 text-text-mute transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white"
            />
          </motion.a>
        ))}
      </motion.div>
    </Section>
  );
}
