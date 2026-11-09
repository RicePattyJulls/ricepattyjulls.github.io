/* Methodology, notes, and site chrome. Selected Work (a case-study card grid)
   was removed in favor of Attack Chains as the single flagship showcase —
   see components/sections/AttackChains.tsx + content/attack-chains.ts. */

export type MethodPhase = {
  step: string;
  title: string;
  body: string;
};

/* The operator spine: recon → hypothesis → validation → impact → report. */
export const methodology: MethodPhase[] = [
  {
    step: "01",
    title: "Recon",
    body: "Map the real attack surface — endpoints, identities, trust boundaries, and the flows a normal user actually touches — before a single payload.",
  },
  {
    step: "02",
    title: "Hypothesis",
    body: "Form a specific, testable theory of how identity, access control, or business logic breaks — not a scanner's guess, a mental model of the target.",
  },
  {
    step: "03",
    title: "Validation",
    body: "Prove exploitability with controlled, reversible actions — or disprove it. A wildcard header is not a finding until impact is demonstrated.",
  },
  {
    step: "04",
    title: "Impact",
    body: "Chain the finding to concrete business impact — account takeover, tenant control, data exposure — not a theoretical CVSS number.",
  },
  {
    step: "05",
    title: "Report",
    body: "Reproducible steps, risk-ranked, written for the team that has to fix it — with remediation they can act on and a retest to confirm it.",
  },
];

export type Note = {
  id: string;
  tag: string;
  title: string;
  excerpt: string;
  readTime: string;
};

export const notes: Note[] = [
  {
    id: "n1",
    tag: "Active Directory",
    title: "A field guide to ADCS ESC1–ESC8",
    excerpt:
      "Certificate services remain one of the most reliable escalation paths in modern AD. A practical map of each misconfiguration and how to spot it.",
    readTime: "9 min",
  },
  {
    id: "n2",
    tag: "Entra ID",
    title: "Conditional access is not a firewall",
    excerpt:
      "Why policy gaps — not policy absence — cause most cloud-identity compromises, and how to audit them the way an attacker would.",
    readTime: "7 min",
  },
  {
    id: "n3",
    tag: "Web",
    title: "IDOR in the age of GraphQL",
    excerpt:
      "Object-level authorization bugs did not disappear with REST. Patterns for finding broken access control in graph APIs.",
    readTime: "6 min",
  },
  {
    id: "n4",
    tag: "OPSEC",
    title: "Attributable by design",
    excerpt:
      "How an authorized red team stays loud enough to be traceable and quiet enough to test detection — at the same time.",
    readTime: "5 min",
  },
];

/* Top navigation mirrors the real pages/domains so it reads as one coherent
   map of the site. `accent` tints the active state to match each domain's
   orbiting node color; `match` is the path prefix used for active detection. */
export type NavItem = {
  label: string;
  href: string;
  accent?: "violet" | "blue" | "cyan" | "danger";
  match?: string;
};

export const nav: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Active Directory", href: "/active-directory", accent: "violet", match: "/active-directory" },
  { label: "Entra ID", href: "/azure-entra", accent: "blue", match: "/azure-entra" },
  { label: "Hacking Web", href: "/hacking-web", accent: "cyan", match: "/hacking-web" },
  { label: "Attack Chains", href: "/attack-chains", accent: "danger", match: "/attack-chains" },
  { label: "Labs", href: "/labs", accent: "violet", match: "/labs" },
  { label: "SOC", href: "/soc-investigations", accent: "cyan", match: "/soc-investigations" },
  { label: "OSINT", href: "/osint", match: "/osint" },
  { label: "Tools", href: "/tools", accent: "violet", match: "/tools" },
  { label: "About", href: "/about", match: "/about" },
];
