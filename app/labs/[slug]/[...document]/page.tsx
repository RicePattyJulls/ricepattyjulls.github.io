import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import SceneBackground from "@/components/canvas/SceneBackground";
import { PageBackdrop } from "@/components/layout/PageBackdrop";
import { Nav } from "@/components/layout/Nav";
import { Section } from "@/components/layout/Section";
import { TechniqueReader } from "@/components/labs/TechniqueReader";
import { LabOverview } from "@/components/labs/LabOverview";
import { getTechniqueMarkdown } from "@/lib/labs";
import { labCases } from "@/content/case-studies";
import { labDocuments, labGroups, documentsForLab, findLabDocument } from "@/content/lab-library";

type Params = { slug: string; document: string[] };
export const dynamicParams = false;
export function generateStaticParams() {
  return [
    ...labDocuments.map(d => ({ slug: d.lab, document: d.page.split("/") })),
    ...labCases.flatMap(lab => labGroups.filter(g => labDocuments.some(d => d.lab === lab.slug && d.group === g.key))
      .map(g => ({ slug: lab.slug, document: [g.key] }))),
  ];
}
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug, document } = await params;
  const page = findLabDocument(slug, document.join("/"));
  const group = document.length === 1 && labGroups.find(g => g.key === document[0]);
  return { title: `${page?.title ?? (group && group.title) ?? "Security Labs"} — RicePattyJulls`, description: page?.description };
}
export default async function Page({ params }: { params: Promise<Params> }) {
  const { slug, document } = await params;
  const lab = labCases.find(l => l.slug === slug);
  if (!lab) notFound();
  const page = findLabDocument(slug, document.join("/"));
  if (!page) {
    const group = document.length === 1 && labGroups.find(g => g.key === document[0]);
    if (!group || !documentsForLab(slug).some(d => d.group === group.key)) notFound();
    return <LabOverview entry={lab} onlyGroup={group.key} />;
  }
  const group = labGroups.find(g => g.key === page.group)!;
  const ordered = documentsForLab(slug);
  const index = ordered.findIndex(d => d.page === page.page);
  const previous = ordered[index - 1];
  const next = ordered[index + 1];
  return <><SceneBackground /><PageBackdrop /><Nav />
    <main className="relative z-10" lang="es">
      <Section className="pt-32 pb-20 lg:pt-40">
        <nav aria-label="Breadcrumb" className="font-mono flex flex-wrap gap-3 text-xs text-text-dim">
          <Link href="/labs">Security Labs</Link><span aria-hidden>/</span>
          <Link href={`/labs/${slug}`}>{lab.title}</Link><span aria-hidden>/</span>
          <Link href={`/labs/${slug}/${group.key}`}>{group.title}</Link>
        </nav>
        <header className="mt-8 border-b border-[color:var(--border)] pb-8">
          <p className="font-mono text-xs uppercase tracking-widest text-text-mute">{group.title} · {index + 1} / {ordered.length}</p>
          <h1 className="font-display mt-4 break-words text-3xl font-semibold tracking-tight sm:text-5xl">{page.title}</h1>
          <p className="mt-5 max-w-3xl text-text-dim">{page.description}</p>
          <p className="mt-4 max-w-3xl text-xs leading-relaxed text-text-mute">Entorno de entrenamiento con alias y valores sensibles sustituidos por marcadores. El recorrido conserva el detalle de la documentación original.</p>
        </header>
        {page.sourceLines < 12 && <p className="mt-6 text-sm text-text-dim">La documentación original de este sistema es breve; no se han añadido pasos o resultados que no consten en ella.</p>}
        <div className="mt-10"><TechniqueReader markdown={getTechniqueMarkdown(`operations/${slug}`, page.page)} /></div>
        <nav aria-label="Navegación del laboratorio" className="mt-16 grid gap-4 border-t border-[color:var(--border)] pt-8 sm:grid-cols-2">
          {previous ? <Link className="panel-strong p-5 text-sm" href={previous.href}>← {previous.title}</Link> : <Link href={`/labs/${slug}`} className="panel-strong p-5 text-sm">← {lab.title}</Link>}
          {next && <Link className="panel-strong p-5 text-sm sm:text-right" href={next.href}>{next.title} →</Link>}
        </nav>
      </Section>
    </main></>;
}
