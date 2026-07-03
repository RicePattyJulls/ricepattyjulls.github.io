"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Route } from "lucide-react";
import { methodology } from "@/content/site";
import { Kicker } from "@/components/ui/primitives";
import { Section } from "@/components/layout/Section";
import { inView } from "@/lib/motion";

export function Methodology() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 70%", "end 60%"],
  });
  const lineScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <Section id="methodology" className="py-24">
      <div className="max-w-xl">
        <Kicker accent="cyan">
          <Route size={12} /> Methodology
        </Kicker>
        <h2 className="font-display mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Disciplined, reversible, and always authorized
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-text-dim">
          A repeatable process that treats the engagement as an outcome, not a
          conquest — proof of impact without collateral damage.
        </p>
      </div>

      <div ref={ref} className="relative mt-14 pl-2">
        {/* vertical rail */}
        <div className="absolute left-[15px] top-2 h-full w-px bg-white/8 sm:left-[19px]">
          <motion.div
            style={{ scaleY: lineScale, transformOrigin: "top" }}
            className="h-full w-full"
          >
            <div
              className="h-full w-full"
              style={{
                background:
                  "linear-gradient(180deg, var(--violet), var(--blue), var(--cyan))",
              }}
            />
          </motion.div>
        </div>

        <div className="flex flex-col gap-10">
          {methodology.map((m, i) => (
            <motion.div
              key={m.step}
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={inView}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="relative flex items-start gap-6 pl-12 sm:pl-16"
            >
              <span
                className="font-mono absolute left-0 grid h-8 w-8 place-items-center rounded-full border bg-bg-0 text-[11px] font-semibold sm:h-10 sm:w-10"
                style={{ borderColor: "var(--border-strong)", color: "var(--violet-soft)" }}
              >
                {m.step}
              </span>
              <div>
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  {m.title}
                </h3>
                <p className="mt-2 max-w-lg text-sm leading-relaxed text-text-dim">
                  {m.body}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}
