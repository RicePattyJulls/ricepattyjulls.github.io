import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Radar } from "lucide-react";
import SceneBackground from "@/components/canvas/SceneBackground";
import { PageBackdrop } from "@/components/layout/PageBackdrop";
import { Nav } from "@/components/layout/Nav";
import { Section } from "@/components/layout/Section";
import { Contact } from "@/components/sections/Contact";
import { navNodes } from "@/content/nav-nodes";

export const metadata: Metadata = {
  title: "OSINT — RicePattyJulls",
  description:
    "Open-source intelligence and reconnaissance — attack-surface, identity, and exposure mapping. Coming soon.",
};

const osint = navNodes.find((n) => n.id === "osint")!;

export default function Page() {
  return (
    <>
      <SceneBackground />
      <PageBackdrop />
      <Nav />
      <main className="relative z-10">
        <Section className="pt-32 pb-20 lg:pt-40">
          <Link
            href="/"
            className="font-mono inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-text-mute transition-colors hover:text-white"
          >
            <ArrowLeft size={12} /> Back to hub
          </Link>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span
              className="font-mono inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.22em]"
              style={{ borderColor: "var(--border-strong)", color: "var(--cyan)" }}
            >
              <Radar size={12} /> OSINT
            </span>
            <span className="font-mono rounded-full border border-[color:var(--border-strong)] bg-white/[0.03] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-text-dim">
              Coming soon
            </span>
          </div>

          <h1 className="font-display mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
            Map the target before you touch it
          </h1>
          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-text-dim sm:text-lg">
            An open-source intelligence and reconnaissance track is in the works —
            built to the same standard as the rest of this notebook: real workflow,
            no filler. It will cover attack-surface mapping, identity and exposure
            discovery, and the repeatable collection pipelines that feed an
            engagement before the first packet.
          </p>

          {/* what's coming */}
          <div className="mt-14">
            <div className="font-mono mb-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-text-mute">
              <span className="hairline w-8" /> What&apos;s coming
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {osint.capabilities.map((c) => (
                <div key={c.label} className="panel-strong relative overflow-hidden p-5">
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-px"
                    style={{ background: "linear-gradient(90deg, transparent, var(--cyan), transparent)" }}
                  />
                  <div className="font-display text-[15px] font-semibold text-white">{c.label}</div>
                  <div className="mt-1.5 text-[13px] leading-relaxed text-text-dim">{c.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </Section>
        <Contact />
      </main>
    </>
  );
}
