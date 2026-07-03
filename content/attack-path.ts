/* Attack-path narrative — the spine of the site. */

export type AttackStage = {
  id: string;
  index: string; // "00".."06"
  phase: string;
  title: string;
  summary: string;
  techniques: string[];
  signals: string[]; // detection / OPSEC notes
  accent: "violet" | "blue" | "cyan" | "danger";
};

export const attackPath: AttackStage[] = [
  {
    id: "recon",
    index: "00",
    phase: "Black Box Recon",
    title: "Zero-knowledge start",
    summary:
      "Begin with nothing but a scope. Passive intelligence builds the target picture without touching production.",
    techniques: [
      "OSINT & ASN / DNS mapping",
      "Certificate transparency mining",
      "Credential-leak correlation",
      "Employee & tech-stack profiling",
    ],
    signals: ["No inbound traffic to client assets", "Third-party sources only"],
    accent: "violet",
  },
  {
    id: "external",
    index: "01",
    phase: "External Surface",
    title: "Map the perimeter",
    summary:
      "Enumerate the reachable edge. Every exposed service is a candidate entry point that must be validated, not assumed.",
    techniques: [
      "Subdomain & port enumeration",
      "TLS / service fingerprinting",
      "Exposed panel & default-cred sweeps",
      "Attack-surface diffing over time",
    ],
    signals: ["Rate-limited, attributable scanning", "Change tickets filed"],
    accent: "blue",
  },
  {
    id: "web",
    index: "02",
    phase: "Web / API",
    title: "Break the application",
    summary:
      "Applications are where business logic and identity meet. Chain flaws to convert access into impact.",
    techniques: [
      "AuthZ / IDOR & access-control bypass",
      "Server-side injection (SSRF, SQLi, template)",
      "Business-logic abuse",
      "Token & session weaknesses",
    ],
    signals: ["WAF telemetry", "Application error spikes"],
    accent: "cyan",
  },
  {
    id: "identity",
    index: "03",
    phase: "Identity Layer",
    title: "Become a user",
    summary:
      "A foothold is a credential. Pivot from application access to a real identity inside the organization.",
    techniques: [
      "Phishing-resistant MFA analysis",
      "OAuth / token replay",
      "Password spraying (throttled)",
      "Conditional-access gap hunting",
    ],
    signals: ["Sign-in log anomalies", "Impossible-travel alerts"],
    accent: "violet",
  },
  {
    id: "tenant",
    index: "04",
    phase: "Tenant Exposure",
    title: "Expand in the cloud",
    summary:
      "Modern estates live in Entra ID and Azure. Map roles, consented apps, and misconfigurations for lateral reach.",
    techniques: [
      "Entra ID role & app-registration review",
      "Managed-identity & key-vault abuse",
      "Cross-tenant trust analysis",
      "Storage & RBAC misconfig hunting",
    ],
    signals: ["Azure activity logs", "Privileged-role assignment alerts"],
    accent: "blue",
  },
  {
    id: "internal",
    index: "05",
    phase: "Internal Domain",
    title: "Own Active Directory",
    summary:
      "On-prem is still the crown jewel. Trace the shortest path from a low-priv user to Domain Admin — then prove it safely.",
    techniques: [
      "Kerberoasting & AS-REP roasting",
      "ACL / delegation abuse (BloodHound)",
      "ADCS certificate escalation",
      "Tiered-admin boundary testing",
    ],
    signals: ["Kerberos ticket anomalies", "DC event correlation"],
    accent: "danger",
  },
  {
    id: "report",
    index: "06",
    phase: "Report",
    title: "Deliver the narrative",
    summary:
      "The engagement isn't the compromise — it's the fix. Every finding maps to reproducible steps and prioritized remediation.",
    techniques: [
      "Reproducible proof-of-concept",
      "Risk-ranked remediation roadmap",
      "Detection-engineering handoff",
      "Executive & technical debriefs",
    ],
    signals: ["Full activity timeline shared", "Retest window scheduled"],
    accent: "cyan",
  },
];
