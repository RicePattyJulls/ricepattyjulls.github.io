"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, FileText, ShieldCheck } from "lucide-react";
import { accentColor, Kicker, KineticHeading } from "@/components/ui/primitives";
import { Section } from "@/components/layout/Section";
import { depthIn, inView, rise, stagger } from "@/lib/motion";

const focus = [
  { value: "AD", label: "Kerberos · Delegation · Trust Abuse", accent: "violet" as const },
  { value: "Entra ID", label: "Token Tradecraft · Graph · ARM", accent: "blue" as const },
  { value: "Cloud", label: "Privilege Escalation · Identity Abuse", accent: "cyan" as const },
  { value: "Web", label: "Auth Bypass · Logic Flaws · API Abuse", accent: "violet" as const },
];

const certs = [
  {
    badge: "CRTO",
    title: "Certified Red Team Operator",
    body: "Red team operations against Windows environments — C2 infrastructure, OPSEC, and Active Directory exploitation end-to-end: credential access, lateral movement, domain dominance, and evasion against modern defenses.",
  },
  {
    badge: "CRTM",
    title: "Certified Red Team Master",
    body: "Advanced red team techniques — complex trust abuse, MSSQL lateral-movement chains, cross-forest pivoting, advanced evasion, and post-exploitation across segmented environments.",
  },
  {
    badge: "CARTE",
    title: "Certified Azure Red Team Expert",
    body: "Azure and Entra ID offensive operations — token theft, Graph and ARM abuse, Key Vault exploitation, Managed Identity abuse, hybrid attack paths, and cross-tenant pivoting. The primary source for the Azure section of this site.",
  },
];

const stack = [
  { name: "Burp Suite", use: "Web and API interception, fuzzing, and request tampering" },
  { name: "BloodHound", use: "Active Directory and Entra attack-path graphing" },
  { name: "Azure / Entra", use: "Cloud identity, Graph, and ARM tradecraft" },
  { name: "KQL", use: "Detection validation and hunting in Sentinel / Defender" },
  { name: "Linux", use: "Operator workstation and tooling" },
  { name: "Python", use: "Automation, proofs of concept, and custom primitives" },
];

const approach = [
  "An operator notebook built from real lab work — Active Directory attack paths from CRTO and CRTM, Entra ID and Azure techniques from CARTE, and web exploitation research from ongoing practice.",
  "Every technique documented here has been validated in a lab environment. The content is sanitized — no live credential material, no exam-specific identifiers, no raw writeups — but the attack logic is real and operator-usable.",
  "The focus is identity and cloud: Active Directory trust abuse, Entra ID token tradecraft, Azure privilege-escalation chains, and the hybrid paths that connect them. Web exploitation is a parallel track. No compliance content, no defensive posturing, no marketing copy.",
];

export function AboutContent() {
  return (
    <Section className="pt-32 pb-8 lg:pt-40">
      {/* intro */}
      <motion.div initial="hidden" animate="show" variants={stagger(0, 0.07)}>
        <motion.div variants={rise}>
          <Kicker accent="violet">Offensive Security Practitioner</Kicker>
        </motion.div>
        <KineticHeading
          text="About"
          as="h1"
          className="font-display mt-4 text-5xl font-semibold tracking-tight sm:text-7xl"
        />
        <motion.p
          variants={rise}
          className="mt-6 max-w-2xl text-pretty text-[15px] leading-relaxed text-text-dim sm:text-lg"
        >
          Red team operator and offensive security researcher focused on identity
          attacks, cloud privilege escalation, and Active Directory exploitation.
          This site is an operator notebook — built from lab work, certification
          material, and hands-on offensive research. Not a showcase of compliance
          deliverables.
        </motion.p>
      </motion.div>

      {/* focus areas */}
      <div className="mt-16">
        <div className="font-mono mb-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-text-mute">
          <span className="hairline w-8" /> Focus Areas
        </div>
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={inView}
          variants={stagger(0.05, 0.06)}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {focus.map((f) => {
            const color = accentColor[f.accent];
            return (
              <motion.div key={f.value} variants={depthIn} className="panel-strong relative overflow-hidden p-5">
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-px"
                  style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
                />
                <div className="font-display text-2xl font-semibold" style={{ color }}>
                  {f.value}
                </div>
                <div className="mt-2 text-[12px] leading-relaxed text-text-dim">{f.label}</div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* approach */}
      <div className="mt-16">
        <div className="font-mono mb-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-text-mute">
          <span className="hairline w-8" /> Approach
        </div>
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={inView}
          variants={stagger(0.05, 0.08)}
          className="max-w-2xl space-y-4"
        >
          {approach.map((p, i) => (
            <motion.p key={i} variants={rise} className="text-[15px] leading-relaxed text-text-dim">
              {p}
            </motion.p>
          ))}
        </motion.div>
      </div>

      {/* stack */}
      <div className="mt-16">
        <div className="font-mono mb-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-text-mute">
          <span className="hairline w-8" /> Stack
        </div>
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={inView}
          variants={stagger(0.04, 0.05)}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {stack.map((s) => (
            <motion.div key={s.name} variants={depthIn} className="panel-strong p-5">
              <div className="font-display text-[15px] font-semibold text-white">{s.name}</div>
              <div className="mt-1.5 text-[13px] leading-relaxed text-text-dim">{s.use}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* certifications */}
      <div className="mt-16">
        <div className="font-mono mb-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-text-mute">
          <span className="hairline w-8" /> Certifications
        </div>
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={inView}
          variants={stagger(0.05, 0.07)}
          className="grid gap-4 md:grid-cols-3"
        >
          {certs.map((c) => (
            <motion.div
              key={c.badge}
              variants={depthIn}
              className="panel-strong group relative flex flex-col overflow-hidden p-6 transition-transform duration-300 hover:-translate-y-1"
            >
              <span
                className="font-mono inline-flex w-fit items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold tracking-wide"
                style={{ borderColor: "var(--border-strong)", color: "var(--violet-soft)" }}
              >
                <ShieldCheck size={12} /> {c.badge}
              </span>
              <h3 className="font-display mt-4 text-lg font-semibold leading-snug tracking-tight text-white">
                {c.title}
              </h3>
              <p className="mt-3 flex-1 text-[13px] leading-relaxed text-text-dim">{c.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* deliverable — sample report */}
      <div className="mt-16">
        <div className="font-mono mb-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-text-mute">
          <span className="hairline w-8" /> Deliverable
        </div>
        <motion.div initial="hidden" whileInView="show" viewport={inView} variants={depthIn}>
          <Link
            href="/reports"
            className="panel-strong group flex flex-col gap-4 overflow-hidden p-6 transition-transform duration-300 hover:-translate-y-1 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-4">
              <span
                className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
                style={{ borderColor: "var(--border-strong)", color: "var(--violet-soft)" }}
              >
                <FileText size={18} />
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold tracking-tight text-white">
                  Sample engagement report
                </h3>
                <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-text-dim">
                  An illustrative, sanitized report — executive summary, findings, and
                  remediation — showing the structure and quality of what you receive.
                </p>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-white">
              View sample
              <ArrowUpRight
                size={15}
                className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                style={{ color: "var(--violet)" }}
              />
            </span>
          </Link>
        </motion.div>
      </div>

      {/* CTA */}
      <motion.div variants={rise} initial="hidden" whileInView="show" viewport={inView} className="mt-14">
        <Link
          href="#contact"
          className="group inline-flex items-center gap-2 text-sm font-medium text-white"
        >
          Get in touch
          <ArrowRight
            size={16}
            className="transition-transform group-hover:translate-x-1"
            style={{ color: "var(--violet)" }}
          />
        </Link>
      </motion.div>
    </Section>
  );
}
