"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowRight, Network, Cloud, Globe } from "lucide-react";
import { domains, type Domain } from "@/content/domains";
import { accentColor, Kicker, KineticHeading } from "@/components/ui/primitives";
import { Section } from "@/components/layout/Section";
import { depthIn, rise, stagger, inView } from "@/lib/motion";

const icons = {
  "active-directory": Network,
  "azure-entra": Cloud,
  "hacking-web": Globe,
} as const;

function DomainBlock({ domain, index }: { domain: Domain; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  // parallax: panel drifts opposite the copy for 2.5D depth
  const yPanel = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const yGlow = useTransform(scrollYProgress, [0, 1], [40, -40]);

  const color = accentColor[domain.accent];
  const Icon = icons[domain.id as keyof typeof icons];
  const reversed = index % 2 === 1;

  return (
    <div
      ref={ref}
      id={domain.id}
      className="relative grid scroll-mt-24 items-center gap-8 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24"
    >
      {/* Copy */}
      <motion.div
        variants={stagger(0, 0.07)}
        initial="hidden"
        whileInView="show"
        viewport={inView}
        className={reversed ? "lg:order-2" : ""}
      >
        <motion.div variants={rise}>
          <Kicker accent={domain.accent}>
            <Icon size={12} /> {domain.kicker}
          </Kicker>
        </motion.div>
        <KineticHeading
          text={domain.title}
          className="font-display mt-4 text-4xl font-semibold tracking-tight sm:text-5xl"
        />
        <motion.p
          variants={rise}
          className="mt-5 max-w-md text-[15px] leading-relaxed text-text-dim"
        >
          {domain.blurb}
        </motion.p>

        <motion.div variants={rise} className="mt-8 flex gap-6">
          {domain.metrics.map((m) => (
            <div key={m.label}>
              <div
                className="font-display tabular text-2xl font-semibold"
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

        <motion.a
          variants={rise}
          href="#contact"
          className="group mt-8 inline-flex items-center gap-2 text-sm font-medium text-white"
        >
          Request an engagement
          <ArrowRight
            size={16}
            className="transition-transform group-hover:translate-x-1"
            style={{ color }}
          />
        </motion.a>
      </motion.div>

      {/* Capability panel with parallax */}
      <motion.div
        style={{ y: yPanel }}
        className={reversed ? "lg:order-1" : ""}
      >
        <motion.div
          variants={depthIn}
          initial="hidden"
          whileInView="show"
          viewport={inView}
          style={{ perspective: 1000 }}
          className="relative"
        >
          <motion.div
            aria-hidden
            style={{ y: yGlow, background: color }}
            className="absolute -inset-6 -z-10 rounded-[32px] opacity-20 blur-3xl"
          />
          <div className="panel-strong edge-violet grid-noise overflow-hidden rounded-3xl p-2">
            <div className="grid gap-px overflow-hidden rounded-2xl sm:grid-cols-2">
              {domain.capabilities.map((c, i) => (
                <motion.div
                  key={c.label}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + i * 0.06, duration: 0.4 }}
                  className="group relative bg-white/[0.015] p-5 transition-colors hover:bg-white/[0.04]"
                >
                  <div
                    className="mb-3 h-8 w-8 rounded-lg border"
                    style={{
                      borderColor: "var(--border-strong)",
                      background: `radial-gradient(circle at 30% 30%, ${color}55, transparent 70%)`,
                    }}
                  />
                  <div className="text-sm font-semibold text-white">
                    {c.label}
                  </div>
                  <div className="mt-1.5 text-xs leading-relaxed text-text-dim">
                    {c.detail}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export function DomainSections() {
  return (
    <Section className="py-8">
      <div className="mb-4 flex items-center gap-3">
        <span className="hairline flex-1" />
        <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-text-mute">
          Identity · Cloud · Application
        </span>
        <span className="hairline flex-1" />
      </div>
      {domains.map((d, i) => (
        <DomainBlock key={d.id} domain={d} index={i} />
      ))}
    </Section>
  );
}
