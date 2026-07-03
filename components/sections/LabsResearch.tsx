"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowUpRight, FlaskConical, Radar } from "lucide-react";
import { accentColor, Kicker } from "@/components/ui/primitives";
import { Section } from "@/components/layout/Section";
import { depthIn, inView, stagger } from "@/lib/motion";
import { adTechniques } from "@/content/active-directory";
import { azureTechniques } from "@/content/azure-entra";
import { webTechniques } from "@/content/hacking-web";

type Lib = {
  domain: string;
  href: string;
  accent: "violet" | "blue" | "cyan";
  count: number;
  blurb: string;
  source: string;
  soon?: boolean;
};

const libs: Lib[] = [
  {
    domain: "Active Directory",
    href: "/active-directory",
    accent: "violet",
    count: adTechniques.length,
    blurb: "Kerberos abuse, delegation, domain dominance, and trust exploitation.",
    source: "CRTO · CRTM lab work",
  },
  {
    domain: "Azure / Entra ID",
    href: "/azure-entra",
    accent: "blue",
    count: azureTechniques.length,
    blurb: "Token tradecraft, Graph and ARM abuse, managed identity, and cross-tenant paths.",
    source: "CARTE lab work",
  },
  {
    domain: "Hacking Web",
    href: "/hacking-web",
    accent: "cyan",
    count: webTechniques.length,
    blurb: "Business logic, access control, real-time recon, and infrastructure misconfig.",
    source: "Field research",
  },
];

export function LabsResearch() {
  return (
    <Section id="labs" className="py-24">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Kicker accent="violet">
            <FlaskConical size={12} /> Labs &amp; Research
          </Kicker>
          <h2 className="font-display mt-3 max-w-xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            A working technique library, not a link dump
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-text-dim">
          Every technique here was validated in a lab and written up with
          preconditions, attack chain, and detection — usable, not theoretical.
        </p>
      </div>

      <motion.div
        variants={stagger(0.05, 0.08)}
        initial="hidden"
        whileInView="show"
        viewport={inView}
        className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4"
      >
        {libs.map((l) => {
          const color = accentColor[l.accent];
          return (
            <motion.div key={l.domain} variants={depthIn} style={{ perspective: 1000 }}>
              <Link
                href={l.href}
                className="group panel-strong relative flex h-full flex-col overflow-hidden rounded-3xl p-6 transition-transform duration-300 hover:-translate-y-1.5"
              >
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-px"
                  style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
                />
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-4xl font-semibold" style={{ color }}>
                    {l.count}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-mute">
                    techniques
                  </span>
                </div>
                <h3 className="font-display mt-4 text-[15px] font-semibold text-white">
                  {l.domain}
                </h3>
                <p className="mt-2 flex-1 text-[13px] leading-relaxed text-text-dim">
                  {l.blurb}
                </p>
                <div className="mt-5 flex items-center justify-between border-t border-[color:var(--border)] pt-4">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-mute">
                    {l.source}
                  </span>
                  <ArrowUpRight
                    size={16}
                    className="text-text-mute transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white"
                  />
                </div>
              </Link>
            </motion.div>
          );
        })}

        {/* OSINT — coming soon */}
        <motion.div variants={depthIn}>
          <Link
            href="/osint"
            className="group panel-strong relative flex h-full flex-col overflow-hidden rounded-3xl p-6 opacity-80 transition-opacity duration-300 hover:opacity-100"
          >
            <div className="flex items-center gap-2 text-text-dim">
              <Radar size={20} style={{ color: "var(--cyan)" }} />
              <span className="font-mono rounded-full border border-[color:var(--border-strong)] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-text-dim">
                Coming soon
              </span>
            </div>
            <h3 className="font-display mt-4 text-[15px] font-semibold text-white">OSINT</h3>
            <p className="mt-2 flex-1 text-[13px] leading-relaxed text-text-dim">
              Attack-surface, identity, and exposure mapping from the outside in.
            </p>
            <div className="mt-5 flex items-center justify-between border-t border-[color:var(--border)] pt-4">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-mute">
                In progress
              </span>
              <ArrowUpRight
                size={16}
                className="text-text-mute transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white"
              />
            </div>
          </Link>
        </motion.div>
      </motion.div>
    </Section>
  );
}
