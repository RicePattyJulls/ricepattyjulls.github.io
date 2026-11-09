import recoveredDocuments from "@/content/lab-documents.json";

export type LabDocument = (typeof recoveredDocuments)[number];
export const labDocuments: LabDocument[] = recoveredDocuments;
export const labGroups = [
  { key: "reference", title: "Contexto y preparación", description: "Entorno, preparación operativa y referencias del recorrido." },
  { key: "paths", title: "Rutas de ataque", description: "Secuencia entre sistemas, condiciones de cada salto y resultados." },
  { key: "domains", title: "Dominios y relaciones de confianza", description: "Identidades, límites de autorización y alcance entre dominios." },
  { key: "hosts", title: "Sistemas y transiciones", description: "Documentación por host con comandos, observaciones y evidencias." },
  { key: "evidence", title: "Evidencias y mapa de compromiso", description: "Inventario de exposición y relaciones del entorno, con valores sensibles sustituidos." },
  { key: "defense", title: "Detección y remediación", description: "Telemetría, mitigaciones y controles asociados a las rutas documentadas." },
] as const;

export function documentsForLab(slug: string) {
  const priority = ["overview", "preparation", "mssql"];
  return labGroups.flatMap(group => labDocuments.filter(d => d.lab === slug && d.group === group.key)
    .sort((a, b) => {
      const rank = (page: string) => priority.includes(page) ? priority.indexOf(page) : priority.length;
      return rank(a.page) - rank(b.page) || a.page.localeCompare(b.page);
    }));
}

export function findLabDocument(slug: string, page: string) {
  return labDocuments.find(d => d.lab === slug && d.page === page);
}
