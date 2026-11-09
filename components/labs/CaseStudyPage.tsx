import Link from "next/link";
import SceneBackground from "@/components/canvas/SceneBackground";
import { PageBackdrop } from "@/components/layout/PageBackdrop";
import { Nav } from "@/components/layout/Nav";
import { Section } from "@/components/layout/Section";
import { TechniqueReader } from "@/components/labs/TechniqueReader";
import { getTechniqueMarkdown } from "@/lib/labs";
import type { CaseStudy } from "@/content/case-studies";

export function CaseStudyPage({ entry, entries, basePath, domain, hubTitle }: {
  entry: CaseStudy; entries: CaseStudy[]; basePath: string; domain: string; hubTitle: string;
}) {
  const index = entries.findIndex(c => c.slug === entry.slug);
  const previous = entries[index - 1];
  const next = entries[index + 1];
  return <><SceneBackground /><PageBackdrop /><Nav />
    <main className="relative z-10" lang="es">
      <Section className="pt-32 pb-20 lg:pt-40">
        <nav aria-label="Breadcrumb" className="font-mono flex flex-wrap gap-3 text-xs text-text-dim">
          <Link href="/">Home</Link><span aria-hidden>/</span><Link href={basePath}>{hubTitle}</Link>
        </nav>
        <header className="mt-8 border-b border-[color:var(--border)] pb-8">
          <p className="font-mono text-xs uppercase tracking-widest text-text-dim">{entry.eyebrow}</p>
          <h1 className="font-display mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">{entry.title}</h1>
          <p className="mt-5 max-w-3xl text-text-dim">{entry.description}</p>
          <ul className="mt-5 flex flex-wrap gap-2" aria-label="Topics">
            {entry.tags.map(tag => <li key={tag} className="font-mono rounded-md border border-[color:var(--border)] px-3 py-1 text-xs text-text-dim">{tag}</li>)}
          </ul>
        </header>
        <div className="mt-10"><TechniqueReader markdown={getTechniqueMarkdown(domain, entry.slug)} /></div>
        <nav aria-label="Case navigation" className="mt-16 flex flex-wrap justify-between gap-5 border-t border-[color:var(--border)] pt-8 text-sm text-text-dim">
          {previous ? <Link href={`${basePath}/${previous.slug}`}>← {previous.title}</Link> : <Link href={basePath}>← {hubTitle}</Link>}
          {next && <Link href={`${basePath}/${next.slug}`}>{next.title} →</Link>}
        </nav>
      </Section>
    </main></>;
}
