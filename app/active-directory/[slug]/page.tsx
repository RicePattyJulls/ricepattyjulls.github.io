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
  adSections,
  adTechniques,
  adTechniquesBySection,
  adTechniquesBySlug,
} from "@/content/active-directory";

/* natural reading order: section order, then technique order within it */
const ordered = Object.keys(adSections).flatMap(
  (key) => adTechniquesBySection[key as keyof typeof adSections],
);

export function generateStaticParams() {
  return adTechniques.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = adTechniquesBySlug[slug as keyof typeof adTechniquesBySlug];
  if (!t) return {};
  return {
    title: `${t.title} — Active Directory · RicePattyJulls`,
    description: t.description,
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const technique = adTechniquesBySlug[slug as keyof typeof adTechniquesBySlug];
  if (!technique) notFound();

  const markdown = getTechniqueMarkdown("active-directory", slug);
  const section = adSections[technique.section as keyof typeof adSections];

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
          {/* breadcrumb */}
          <nav className="font-mono flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-text-mute">
            <Link href="/" className="transition-colors hover:text-white">
              Hub
            </Link>
            <span>/</span>
            <Link href="/active-directory" className="transition-colors hover:text-white">
              Active Directory
            </Link>
            <span>/</span>
            <span style={{ color: "var(--violet)" }}>{section.title}</span>
          </nav>

          {/* header */}
          <header className="mt-6 border-b border-[color:var(--border)] pb-8">
            <span
              className="font-mono text-[11px] uppercase tracking-[0.22em]"
              style={{ color: "var(--violet)" }}
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

          {/* body */}
          <div className="mt-10">
            <TechniqueReader markdown={markdown} />
          </div>

          {/* prev / next */}
          <nav className="mt-16 grid gap-4 border-t border-[color:var(--border)] pt-8 sm:grid-cols-2">
            {prev ? (
              <Link
                href={`/active-directory/${prev.slug}`}
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
                href={`/active-directory/${next.slug}`}
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
