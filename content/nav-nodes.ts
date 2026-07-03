/* Operator navigation graph — the 4 interactive domain nodes that now live
   INSIDE the particle core. Hovering a node reveals what each domain covers
   (the capability list that used to be a full section on the page).
   Positions (`pos`) are % of the hero box; the whole layer is a swappable
   content unit. `side` = the direction label + tooltip open toward (outward,
   away from the bright center, so they stay legible over the darker edges). */

export type NavCapability = { label: string; detail: string };

export type NavNode = {
  id: string;
  title: string;
  /* short, punchy headline shown large on the domain card */
  tagline: string;
  description: string;
  tags: string[];
  /* what you can find in this domain — surfaced on hover */
  capabilities: NavCapability[];
  cta: string;
  href: string;
  accent: "violet" | "blue" | "cyan";
  /* domain announced but not yet published — card shows a "Coming soon" state */
  comingSoon?: boolean;
  /* placement on the desktop constellation, in % of the hero box */
  pos: { x: number; y: number };
  /* side the label + tooltip open toward, so they never leave the viewport */
  side: "left" | "right";
};

export const navNodes: NavNode[] = [
  {
    id: "active-directory",
    title: "Active Directory",
    tagline: "From foothold to Domain Admin",
    description:
      "The shortest, safest path from a foothold to Domain Admin — every hop documented so blue teams can close it.",
    tags: ["Kerberos", "Delegation", "ACL Abuse", "Trusts", "Lateral Movement"],
    capabilities: [
      { label: "Kerberos abuse", detail: "Kerberoasting, AS-REP roasting, delegation attacks" },
      { label: "ACL / graph analysis", detail: "BloodHound path-finding across trusts and OUs" },
      { label: "ADCS escalation", detail: "Certificate-template misconfig to domain takeover" },
      { label: "Tiering validation", detail: "Admin-tier boundaries and PAW controls" },
    ],
    cta: "Open Active Directory",
    href: "/active-directory",
    accent: "violet",
    pos: { x: 35, y: 31 },
    side: "left",
  },
  {
    id: "azure-entra",
    title: "Azure / Entra ID",
    tagline: "Own the cloud identity plane",
    description:
      "Cloud identity is the new perimeter — mapping roles, consented apps, and managed identities for lateral reach.",
    tags: ["Tokens", "Graph", "RBAC", "Managed Identity", "Key Vault"],
    capabilities: [
      { label: "Role & app review", detail: "Privileged roles, app registrations, consent grants" },
      { label: "Managed identity abuse", detail: "Token theft, key-vault and storage pivots" },
      { label: "Conditional access", detail: "Gap analysis against phishing-resistant policy" },
      { label: "Cross-tenant trust", detail: "B2B, guest, and federation boundary testing" },
    ],
    cta: "Open Azure / Entra ID",
    href: "/azure-entra",
    accent: "blue",
    pos: { x: 65, y: 31 },
    side: "right",
  },
  {
    id: "hacking-web",
    title: "Hacking Web",
    tagline: "Break the logic, own the app",
    description:
      "Where business logic meets identity — chaining access-control, injection, and logic flaws into real impact.",
    tags: ["IDOR", "Auth Bypass", "APIs", "Access Control", "Logic Flaws"],
    capabilities: [
      { label: "Access control", detail: "IDOR, broken authZ, privilege boundaries" },
      { label: "Server-side injection", detail: "SSRF, SQLi, template and deserialization" },
      { label: "Logic abuse", detail: "Race conditions, workflow and pricing bypass" },
      { label: "Token security", detail: "JWT, OAuth flows, session fixation" },
    ],
    cta: "Open Hacking Web",
    href: "/hacking-web",
    accent: "cyan",
    pos: { x: 35, y: 69 },
    side: "left",
  },
  {
    id: "tools",
    title: "Tools",
    tagline: "Field-built offensive tooling",
    description:
      "Personal offensive-security tooling — built in the field and sharpened on real engagements.",
    tags: ["Recon", "Automation", "Scripts", "Workflow", "Reporting"],
    capabilities: [
      { label: "Recon", detail: "Attack-surface mapping and asset discovery pipelines" },
      { label: "Automation", detail: "Chained enumeration and exploitation to cut dead time" },
      { label: "Scripts", detail: "Purpose-built primitives for AD, cloud, and web" },
      { label: "Reporting", detail: "Evidence capture and client-ready write-ups" },
    ],
    cta: "Open Tools",
    href: "/tools",
    accent: "violet",
    pos: { x: 65, y: 69 },
    side: "right",
  },
  {
    id: "osint",
    title: "OSINT",
    tagline: "Map the target before you touch it",
    description:
      "Open-source intelligence and reconnaissance — attack-surface, identity, and exposure mapping from the outside in.",
    tags: ["Recon", "Attack Surface", "Identity", "Exposure"],
    capabilities: [
      { label: "Attack-surface mapping", detail: "External footprint, assets, and shadow infrastructure" },
      { label: "Identity & people", detail: "Employees, roles, and credential exposure" },
      { label: "Exposure discovery", detail: "Leaks, secrets, and misconfigured public services" },
      { label: "Recon pipelines", detail: "Repeatable collection and correlation workflows" },
    ],
    cta: "Coming soon",
    href: "/osint",
    accent: "cyan",
    comingSoon: true,
    pos: { x: 50, y: 50 },
    side: "right",
  },
];
