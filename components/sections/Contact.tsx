"use client";

import { motion } from "framer-motion";
import { Mail, Lock, ArrowUpRight, Terminal, AtSign, FileText } from "lucide-react";
import { KineticHeading, MagneticButton } from "@/components/ui/primitives";
import { Section } from "@/components/layout/Section";
import { inView, rise, stagger } from "@/lib/motion";

/* External contact points. */
const links = [
  { label: "GitHub", href: "https://github.com/RicePattyJulls", icon: Terminal, external: true },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/stwarsmurrieta/", icon: AtSign, external: true },
  { label: "CV (EN)", href: "/cv/stwars-murrieta-cv-en.pdf", icon: FileText, external: false },
  { label: "CV (ES)", href: "/cv/stwars-murrieta-cv-es.pdf", icon: FileText, external: false },
];

export function Contact() {
  return (
    <Section id="contact" className="py-24">
      <motion.div
        variants={stagger(0, 0.08)}
        initial="hidden"
        whileInView="show"
        viewport={inView}
        className="panel-strong edge-violet relative overflow-hidden rounded-[32px] px-6 py-16 text-center sm:px-16 sm:py-24"
      >
        {/* bloom */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 -translate-y-1/3 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(124,92,255,0.5), transparent 70%)",
          }}
        />
        <motion.span
          variants={rise}
          className="font-mono relative inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px] uppercase tracking-[0.22em] text-text-dim"
          style={{ borderColor: "var(--border-strong)" }}
        >
          <Lock size={12} /> Authorized engagements only
        </motion.span>

        <KineticHeading
          text="Ready to test what you defend?"
          className="font-display relative mx-auto mt-6 max-w-2xl text-balance text-3xl font-semibold tracking-tight text-glow sm:text-5xl"
        />

        <motion.p
          variants={rise}
          className="relative mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-text-dim"
        >
          Scoping starts with a conversation and a signed rules-of-engagement.
          Tell me what matters most, and I&apos;ll map the path an adversary
          would take to reach it.
        </motion.p>

        <motion.div
          variants={rise}
          className="relative mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <MagneticButton href="mailto:stwarsmurrieta02@gmail.com">
            <Mail size={16} /> Start scoping <ArrowUpRight size={15} />
          </MagneticButton>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {links.map(({ label, href, icon: Icon, external }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-strong)] px-4 py-2.5 text-[13px] font-medium text-text-dim transition-colors hover:text-white"
              >
                <Icon size={16} /> {label}
              </a>
            ))}
          </div>
        </motion.div>
      </motion.div>

      <footer className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-[color:var(--border)] pt-8 text-center sm:flex-row sm:text-left">
        <span className="font-mono text-xs text-text-mute">
          © {new Date().getFullYear()} RicePattyJulls · Red Team Operator
        </span>
        <span className="font-mono flex items-center gap-2 text-xs text-text-mute">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--recon)", boxShadow: "0 0 8px var(--recon)" }}
          />
          Authorized engagements · responsible disclosure
        </span>
      </footer>
    </Section>
  );
}
