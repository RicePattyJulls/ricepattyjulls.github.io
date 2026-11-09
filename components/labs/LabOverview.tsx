import Link from "next/link";
import SceneBackground from "@/components/canvas/SceneBackground";
import { PageBackdrop } from "@/components/layout/PageBackdrop";
import { Nav } from "@/components/layout/Nav";
import { Section } from "@/components/layout/Section";
import { LabCatalog } from "@/components/labs/LabCatalog";
import { documentsForLab, labGroups } from "@/content/lab-library";
import type { CaseStudy } from "@/content/case-studies";

export function LabOverview({ entry, onlyGroup }: { entry: CaseStudy; onlyGroup?: string }) {
  const docs = documentsForLab(entry.slug);
  const group = labGroups.find(g => g.key === onlyGroup);
  const shown = group ? docs.filter(d => d.group === group.key) : docs;
  return <><SceneBackground /><PageBackdrop /><Nav />
    <main className="relative z-10" lang="es">
      <Section className="pt-32 pb-20 lg:pt-40">
        <nav aria-label="Breadcrumb" className="font-mono flex flex-wrap gap-3 text-xs text-text-dim">
          <Link href="/labs">Security Labs</Link>
          {group && <><span aria-hidden>/</span><Link href={`/labs/${entry.slug}`}>{entry.title}</Link></>}
        </nav>
        <header className="mt-8 border-b border-[color:var(--border)] pb-8">
          <p className="font-mono text-xs uppercase tracking-widest text-text-dim">{entry.eyebrow}</p>
          <h1 className="font-display mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">{group?.title ?? entry.title}</h1>
          <p className="mt-5 max-w-3xl leading-relaxed text-text-dim">{group?.description ?? entry.description}</p>
          <dl className="mt-7 flex flex-wrap gap-8">
            {[{ label: "Documentos", value: shown.length },
              { label: "Rutas de ataque", value: docs.filter(d => d.group === "paths").length },
              { label: "Dominios", value: docs.filter(d => d.group === "domains").length },
              { label: "Sistemas y transiciones", value: docs.filter(d => d.group === "hosts").length }].map(stat =>
              <div key={stat.label}><dt className="text-xs text-text-mute">{stat.label}</dt><dd className="font-display mt-1 text-2xl text-[color:var(--violet)]">{stat.value}</dd></div>)}
          </dl>
        </header>
        <p className="mt-7 max-w-3xl text-sm leading-relaxed text-text-dim">
          Documentación del laboratorio con sus comandos, observaciones y resultados. Los dominios y direcciones usan alias consistentes; contraseñas, hashes de autenticación y valores de objetivos se sustituyen por marcadores. Las recomendaciones de remediación se distinguen de las acciones realizadas.
        </p>
        <LabCatalog slug={entry.slug} onlyGroup={onlyGroup} />
        <div className="mt-12 flex flex-wrap gap-6 border-t border-[color:var(--border)] pt-6 text-sm text-text-dim">
          <Link href="/labs">← Security Labs</Link>
          <Link href="/soc-investigations">Investigaciones SOC →</Link>
        </div>
      </Section>
    </main></>;
}
