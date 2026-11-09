// Case metadata contains no source paths or recovered secrets.
export type CaseStudy = {
  title: string; description: string; section: string; order: number;
  eyebrow: string; tags: readonly string[]; summary: readonly string[]; slug: string;
};
export const labCases: CaseStudy[] = [
  {
    "title": "Cobalt Strike Operations",
    "description": "Operaciones con Cobalt Strike: preparación del C2, acceso inicial, pivotes internos, delegación, SQL CLR y acceso entre dominios.",
    "section": "crto",
    "order": 1,
    "eyebrow": "Cobalt Strike · Domain Operations",
    "tags": [
      "Cobalt Strike",
      "18 documentos",
      ".NET Framework"
    ],
    "summary": [
      "18 documentos con preparación, comandos, evidencias y mitigación.",
      "Cuatro rutas de ataque, tres dominios y ocho sistemas documentados.",
      "Recorrido operativo con páginas por dominio, sistema y transición."
    ],
    "slug": "crto-lab"
  },
  {
    "title": "Escalada y movimiento lateral entre bosques",
    "description": "Del acceso inicial en un dominio hijo a rutas de delegación, PAM, WSUS y Exchange: recorrido sanitizado de un entorno de laboratorio.",
    "section": "crtm",
    "order": 1,
    "eyebrow": "Active Directory · Attack Paths",
    "tags": [
      "Active Directory",
      "Multi-forest",
      "Recorrido sanitizado"
    ],
    "summary": [
      "38 documentos: nueve dominios, cinco rutas y 19 páginas de sistemas o transiciones.",
      "Resultados, caminos sin impacto adicional y límites documentados.",
      "Detección y remediación vinculadas a cada fase."
    ],
    "slug": "gcb-lab"
  }
];
export const socCases: CaseStudy[] = [
  {
    "title": "Phishing con Elastic",
    "description": "Investigación CDSA: de invoice.doc a PowerShell, persistencia, movimiento lateral y actividad en el controlador de dominio.",
    "section": "elastic",
    "order": 1,
    "eyebrow": "CDSA · Elastic",
    "tags": [
      "Elastic",
      "Kibana Query Language",
      "Sysmon"
    ],
    "summary": [
      "Reconstrucción de procesos con ProcessGuid y cronología.",
      "Consultas KQL de Kibana y correlación de eventos.",
      "Análisis y conclusiones, sin respuestas de evaluación."
    ],
    "slug": "elastic-phishing"
  },
  {
    "title": "Posible DCSync con Splunk",
    "description": "Investigación CDSA: derechos de replicación, credenciales explícitas y ejecución remota; extracción de hashes no demostrada.",
    "section": "splunk",
    "order": 1,
    "eyebrow": "CDSA · Splunk",
    "tags": [
      "Splunk",
      "SPL",
      "DCSync"
    ],
    "summary": [
      "32 eventos de la cuenta de interés en unos 95 segundos.",
      "Correlación de autenticación, red y ejecución por WMI.",
      "Hechos confirmados separados de hipótesis pendientes."
    ],
    "slug": "splunk-dcsync"
  }
];
export const labSections = {
  "crto": {
    "title": "Cobalt Strike",
    "description": "Operaciones de C2 y recorrido de compromiso: acceso inicial, delegación, SQL, control de dominio y enclave.",
    "tag": "01 / Cobalt Strike"
  },
  "crtm": {
    "title": "Active Directory Attack Paths",
    "description": "Escalada de privilegios, delegación y movimiento lateral entre dominios y bosques.",
    "tag": "02 / Active Directory · Attack Paths"
  }
};
export const socSections = {
  "elastic": {
    "title": "Elastic · Phishing",
    "description": "Investigación basada en Sysmon, PowerShell y eventos de seguridad.",
    "tag": "01 / Elastic"
  },
  "splunk": {
    "title": "Splunk · Replicación de directorio",
    "description": "Correlación de telemetría y evaluación explícita de la confianza.",
    "tag": "02 / Splunk"
  }
};
export function groupCases(cases: CaseStudy[]) {
  return Object.fromEntries([...new Set(cases.map(c => c.section))].map(key =>
    [key, cases.filter(c => c.section === key).sort((a, b) => a.order - b.order)]));
}
