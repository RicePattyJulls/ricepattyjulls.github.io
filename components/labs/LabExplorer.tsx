"use client";

import { useId, useMemo, useState } from "react";
import { ArrowUpRight, BookOpen, Network, Route, Search, Server, ShieldCheck, Terminal, X, ScanEye } from "lucide-react";
import { DepthCard } from "@/components/ui/DepthCard";

type Document = { title: string; description: string; href: string; group: string; page: string };
type Group = { key: string; title: string; description: string };
const themes = {
  reference: { Icon: Terminal, color: "#a78bfa", label: "Operaciones", action: "Explorar contenido" },
  paths: { Icon: Route, color: "#38bdf8", label: "Attack path", action: "Seguir la ruta" },
  domains: { Icon: Network, color: "#818cf8", label: "Identity", action: "Explorar dominio" },
  hosts: { Icon: Server, color: "#2dd4bf", label: "Host analysis", action: "Abrir análisis" },
  evidence: { Icon: ScanEye, color: "#c084fc", label: "Evidence", action: "Examinar evidencias" },
  defense: { Icon: ShieldCheck, color: "#60a5fa", label: "Defense", action: "Revisar controles" },
};
function searchable(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function LabExplorer({ documents, groups }: { documents: Document[]; groups: Group[] }) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("all");
  const visible = useMemo(() => documents.filter(d =>
    (active === "all" || d.group === active) && searchable(`${d.title} ${d.description} ${d.page}`).includes(searchable(query.trim()))),
  [documents, query, active]);
  const reset = () => { setQuery(""); setActive("all"); };

  return <div className="lab-explorer mt-8">
    <div className="lab-explorer__toolbar">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 text-sm font-medium text-white"><BookOpen size={17} className="text-violet-300" /> Explorar laboratorio</div>
        <p role="status" aria-live="polite" aria-atomic="true" className="font-mono text-[11px] text-text-dim">{visible.length} de {documents.length} documentos</p>
      </div>
      <label htmlFor={searchId} className="sr-only">Buscar en el laboratorio</label>
      <div className="lab-explorer__search mt-4">
        <Search size={17} aria-hidden className="shrink-0 text-text-mute" />
        <input id={searchId} type="search" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Buscar sistema, técnica o dominio…" className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder:text-text-mute" />
        {query && <button type="button" aria-label="Borrar búsqueda" onClick={() => setQuery("")} className="rounded-md p-1.5 text-text-dim hover:text-white focus-visible:outline-2 focus-visible:outline-violet-300"><X size={16} /></button>}
      </div>
      {groups.length > 1 && <div role="group" aria-label="Filtrar por categoría" className="mt-4 flex flex-wrap gap-2">
        {[{ key: "all", title: "Todos" }, ...groups].map(g => <button key={g.key} type="button"
          aria-pressed={active === g.key} onClick={() => setActive(g.key)} className="lab-filter">
          {g.title}<span aria-hidden>{g.key === "all" ? documents.length : documents.filter(d => d.group === g.key).length}</span>
        </button>)}
      </div>}
    </div>

    <div className="mt-10 space-y-12">
      {groups.map((group, index) => {
        const pages = visible.filter(d => d.group === group.key);
        if (!pages.length) return null;
        const theme = themes[group.key as keyof typeof themes] ?? themes.reference;
        const Icon = theme.Icon;
        return <section key={group.key} id={group.key} className="scroll-mt-28" aria-label={group.title}>
          <div className="mb-5 flex items-start gap-3">
            <span className="lab-section-number" style={{ color: theme.color }}>{String(index + 1).padStart(2,"0")}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="font-display text-xl font-semibold sm:text-2xl">{group.title}</h2>
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-mute">{pages.length} documentos</span>
              </div>
              <p className="mt-1.5 text-sm text-text-dim">{group.description}</p>
            </div>
          </div>
          <ul className="lab-card-grid grid gap-5 md:grid-cols-2">
            {pages.map((page, pageIndex) => <li key={page.page} className="min-w-0">
              <DepthCard href={page.href} accent={theme.color} className="lab-document-card h-full p-6 sm:p-7">
                <Icon aria-hidden className="lab-card-watermark" strokeWidth={0.8} />
                <div className="flex items-center justify-between gap-3">
                  <span className="lab-card-icon" style={{ color: theme.color }}><Icon size={21} strokeWidth={1.5} /></span>
                  <span className="font-mono text-[10px] tracking-[0.15em] text-text-mute">{theme.label} / {String(pageIndex + 1).padStart(2,"0")}</span>
                </div>
                <h3 className="font-display mt-5 max-w-[95%] text-[17px] font-semibold leading-snug tracking-tight text-white sm:text-lg">{page.title}</h3>
                <p className="mt-3 flex-1 text-[13px] leading-relaxed text-text-dim">{page.description}</p>
                <div className="lab-card-footer mt-6 flex items-center justify-between gap-3 pt-4">
                  <span className="text-xs font-medium" style={{ color: theme.color }}>{theme.action}</span>
                  <span className="lab-card-arrow" aria-hidden><ArrowUpRight size={17} /></span>
                </div>
              </DepthCard>
            </li>)}
          </ul>
        </section>;
      })}
      {!visible.length && <div className="rounded-2xl border border-[color:var(--border)] bg-white/[0.02] px-6 py-12 text-center">
        <Search size={25} className="mx-auto text-text-mute" aria-hidden />
        <h2 className="font-display mt-4 text-xl font-semibold">No hay documentos con esos filtros</h2>
        <p className="mt-2 text-sm text-text-dim">Prueba con otro sistema, técnica o dominio.</p>
        <button type="button" onClick={reset} className="lab-filter mt-5">Restablecer filtros</button>
      </div>}
    </div>
  </div>;
}
