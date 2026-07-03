import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldAlert } from "lucide-react";
import SceneBackground from "@/components/canvas/SceneBackground";
import { PageBackdrop } from "@/components/layout/PageBackdrop";
import { Nav } from "@/components/layout/Nav";
import { TechniqueReader } from "@/components/labs/TechniqueReader";
import { Section } from "@/components/layout/Section";
import { getTechniqueMarkdown } from "@/lib/labs";
import {
  chainSections,
  attackChains,
  chainsBySection,
  chainsBySlug,
} from "@/content/attack-chains";

/* natural reading order: section order, then chain order within it */
const ordered = Object.keys(chainSections).flatMap(
  (key) => chainsBySection[key as keyof typeof chainSections],
);

export function generateStaticParams() {
  return attackChains.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = chainsBySlug[slug as keyof typeof chainsBySlug];
  if (!c) return {};
  return {
    title: `${c.title} — Attack Chains · RicePattyJulls`,
    description: c.description,
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const chain = chainsBySlug[slug as keyof typeof chainsBySlug];
  if (!chain) notFound();

  const markdown = getTechniqueMarkdown("attack-chains", slug);
  const section = chainSections[chain.section as keyof typeof chainSections];

  const idx = ordered.findIndex((c) => c.slug === slug);
  const prev = idx > 0 ? ordered[idx - 1] : null;
  const next = idx < ordered.length - 1 ? ordered[idx + 1] : null;

  return (
    <>
      <SceneBackground />
      <PageBackdrop />
      <Nav />
      <main className="relative z-10">
        <Section className="pt-28 pb-20 lg:pt-32">
          {/* breadcrumb */}
          <nav className="font-mono flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-text-mute">
            <Link href="/" className="transition-colors hover:text-white">
              Hub
            </Link>
            <span>/</span>
            <Link href="/attack-chains" className="transition-colors hover:text-white">
              Attack Chains
            </Link>
            <span>/</span>
            <span style={{ color: "var(--danger)" }}>{section.title}</span>
          </nav>

          {/* header */}
          <header className="mt-6 border-b border-[color:var(--border)] pb-8">
            <span
              className="font-mono inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em]"
              style={{ color: "var(--danger)" }}
            >
              <ShieldAlert size={13} /> {section.tag}
            </span>
            <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
              {chain.title}
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-text-dim">
              {chain.description}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {chain.tags.map((tag) => (
                <span
                  key={tag}
                  className="font-mono rounded-md border px-2.5 py-1 text-[11px] tracking-wide text-text-dim"
                  style={{ borderColor: "var(--border-strong)", background: "rgba(255,255,255,0.02)" }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </header>

          {/* body */}
          <div className="mt-10">
            <TechniqueReader markdown={markdown} />
          </div>

          {/* prev / next */}
          <nav className="mt-16 grid gap-4 border-t border-[color:var(--border)] pt-8 sm:grid-cols-2">
            {prev ? (
              <Link
                href={`/attack-chains/${prev.slug}`}
                className="panel-strong group flex flex-col gap-1 p-5 transition-transform hover:-translate-y-0.5"
              >
                <span className="font-mono flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-text-mute">
                  <ArrowLeft size={12} /> Previous
                </span>
                <span className="text-sm font-medium text-white group-hover:text-white">
                  {prev.title}
                </span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={`/attack-chains/${next.slug}`}
                className="panel-strong group flex flex-col items-end gap-1 p-5 text-right transition-transform hover:-translate-y-0.5 sm:col-start-2"
              >
                <span className="font-mono flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-text-mute">
                  Next <ArrowRight size={12} />
                </span>
                <span className="text-sm font-medium text-white">{next.title}</span>
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </Section>
      </main>
    </>
  );
}
