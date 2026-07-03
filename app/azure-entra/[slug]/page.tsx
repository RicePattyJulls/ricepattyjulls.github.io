import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import SceneBackground from "@/components/canvas/SceneBackground";
import { PageBackdrop } from "@/components/layout/PageBackdrop";
import { Nav } from "@/components/layout/Nav";
import { TechniqueReader } from "@/components/labs/TechniqueReader";
import { Section } from "@/components/layout/Section";
import { getTechniqueMarkdown } from "@/lib/labs";
import {
  azureSections,
  azureTechniques,
  azureTechniquesBySection,
  azureTechniquesBySlug,
} from "@/content/azure-entra";

/* natural reading order: section order, then technique order within it */
const ordered = Object.keys(azureSections).flatMap(
  (key) => azureTechniquesBySection[key as keyof typeof azureSections] ?? [],
);

export function generateStaticParams() {
  return azureTechniques.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = azureTechniquesBySlug[slug];
  if (!t) return {};
  return {
    title: `${t.title} — Azure / Entra ID · RicePattyJulls`,
    description: t.description,
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const technique = azureTechniquesBySlug[slug];
  if (!technique) notFound();

  const markdown = getTechniqueMarkdown("azure-entra", slug);
  const section = azureSections[technique.section as keyof typeof azureSections];

  const idx = ordered.findIndex((t) => t.slug === slug);
  const prev = idx > 0 ? ordered[idx - 1] : null;
  const next = idx < ordered.length - 1 ? ordered[idx + 1] : null;

  return (
    <>
      <SceneBackground />
      <PageBackdrop />
      <Nav />
      <main className="relative z-10">
        <Section className="pt-28 pb-20 lg:pt-32">
          <nav className="font-mono flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-text-mute">
            <Link href="/" className="transition-colors hover:text-white">
              Hub
            </Link>
            <span>/</span>
            <Link href="/azure-entra" className="transition-colors hover:text-white">
              Azure / Entra ID
            </Link>
            <span>/</span>
            <span style={{ color: "var(--blue)" }}>{section.title}</span>
          </nav>

          <header className="mt-6 border-b border-[color:var(--border)] pb-8">
            <span
              className="font-mono text-[11px] uppercase tracking-[0.22em]"
              style={{ color: "var(--blue)" }}
            >
              {section.tag}
            </span>
            <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
              {technique.title}
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-text-dim">
              {technique.description}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {technique.tags.map((tag) => (
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

          <div className="mt-10">
            <TechniqueReader markdown={markdown} />
          </div>

          <nav className="mt-16 grid gap-4 border-t border-[color:var(--border)] pt-8 sm:grid-cols-2">
            {prev ? (
              <Link
                href={`/azure-entra/${prev.slug}`}
                className="panel-strong group flex flex-col gap-1 p-5 transition-transform hover:-translate-y-0.5"
              >
                <span className="font-mono flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-text-mute">
                  <ArrowLeft size={12} /> Previous
                </span>
                <span className="text-sm font-medium text-white">{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={`/azure-entra/${next.slug}`}
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
