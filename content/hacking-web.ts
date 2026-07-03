export const webSections = {
  "recon": {
    "title": "Recon & Discovery",
    "description": "Surfacing hidden endpoints, real-time events, and application behaviour before touching a single payload.",
    "tag": "01 / Recon & Discovery"
  },
  "access-control": {
    "title": "Access Control & Business Logic",
    "description": "Chaining legitimate flows and identity confusion into unauthorized access and full account takeover.",
    "tag": "02 / Access Control & Logic"
  },
  "infra-misconfig": {
    "title": "Infrastructure & Misconfiguration",
    "description": "Browser-trust, caching, and proxy misconfigurations that turn into real exposure under the right conditions.",
    "tag": "03 / Infrastructure & Misconfig"
  }
} as const;

export const webTechniques = [
  {
    "title": "Socket.IO Recon",
    "description": "Enumerating real-time events, hidden endpoints, and delegated-flow authorization across Socket.IO / WebSocket applications.",
    "section": "recon",
    "order": 1,
    "eyebrow": "Recon & Discovery",
    "tags": [
      "WebSocket",
      "Socket.IO",
      "IDOR"
    ],
    "summary": [
      "Extracts emitted and listened events straight from the frontend bundle.",
      "Connects to the Socket.IO endpoint with a valid JWT to exercise live flows.",
      "Probes delegated actions to confirm real server-side authorization."
    ],
    "slug": "socket-io-recon"
  },
  {
    "title": "Business Logic Account Takeover Chain",
    "description": "A full external-to-account-takeover chain built from legitimate flows — public signup, JWT, backend discovery, and a panel login IDOR behind Cloudflare.",
    "section": "access-control",
    "order": 1,
    "eyebrow": "Access Control & Business Logic",
    "tags": [
      "Business Logic",
      "IDOR",
      "Account Takeover",
      "JWT"
    ],
    "summary": [
      "Turns a public signup into a functional internal identity.",
      "Maps the hidden backend panel from its own JavaScript bundle.",
      "Abuses a login IDOR: own password + target email yields the target's session."
    ],
    "slug": "business-logic-account-takeover"
  },
  {
    "title": "CORS Misconfigurations",
    "description": "When Access-Control-Allow-Origin: * is only informational, and when it is a real, exploitable data-exposure bug.",
    "section": "infra-misconfig",
    "order": 1,
    "eyebrow": "Infrastructure & Misconfiguration",
    "tags": [
      "CORS",
      "Browser Security",
      "Access Control"
    ],
    "summary": [
      "Separates a harmless wildcard from a credentialed, reflected origin.",
      "Identifies the dangerous combination that makes CORS actually exploitable.",
      "Validates impact safely with curl before ever calling it a finding."
    ],
    "slug": "cors-misconfigurations"
  },
  {
    "title": "Web Cache Poisoning",
    "description": "Why cf-cache-status: DYNAMIC does not mean safe — poisoning a caching layer behind Cloudflare through unkeyed Host input.",
    "section": "infra-misconfig",
    "order": 2,
    "eyebrow": "Infrastructure & Misconfiguration",
    "tags": [
      "Cache Poisoning",
      "Host Header",
      "Reverse Proxy"
    ],
    "summary": [
      "Models the layered caches that hide behind a single CDN.",
      "Poisons a response via unkeyed Host input and confirms persistence.",
      "Scopes severity honestly and maps it to concrete remediation."
    ],
    "slug": "web-cache-poisoning"
  }
] as const;

export type WebTechnique = (typeof webTechniques)[number];

export const webTechniquesBySection = Object.fromEntries(
  Object.keys(webSections).map((key) => [
    key,
    webTechniques.filter((item) => item.section === key),
  ]),
) as Record<keyof typeof webSections, WebTechnique[]>;

export const webTechniquesBySlug = Object.fromEntries(
  webTechniques.map((item) => [item.slug, item]),
) as Record<string, WebTechnique>;
