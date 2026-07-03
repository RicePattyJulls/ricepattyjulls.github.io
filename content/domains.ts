/* Domain expertise sections: Active Directory, Entra ID / Azure, Web Exploitation. */

export type DomainCapability = {
  label: string;
  detail: string;
};

export type Domain = {
  id: string;
  kicker: string;
  title: string;
  blurb: string;
  accent: "violet" | "blue" | "cyan";
  capabilities: DomainCapability[];
  metrics: { value: string; label: string }[];
};

export const domains: Domain[] = [
  {
    id: "active-directory",
    kicker: "Internal Domain",
    title: "Active Directory",
    blurb:
      "Tracing the shortest, safest path from a foothold to Domain Admin — and documenting every hop so blue teams can close it.",
    accent: "violet",
    capabilities: [
      { label: "Kerberos abuse", detail: "Kerberoasting, AS-REP roasting, delegation attacks" },
      { label: "ACL / graph analysis", detail: "BloodHound path-finding across trusts and OUs" },
      { label: "ADCS escalation", detail: "Certificate-template misconfig to domain takeover" },
      { label: "Tiering validation", detail: "Testing admin-tier boundaries and PAW controls" },
    ],
    metrics: [
      { value: "3", label: "avg. hops to DA" },
      { value: "12+", label: "escalation primitives" },
      { value: "100%", label: "reproducible paths" },
    ],
  },
  {
    id: "azure-entra",
    kicker: "Tenant Exposure",
    title: "Entra ID / Azure",
    blurb:
      "Cloud identity is the new perimeter. Mapping roles, consented apps, and managed identities to find lateral reach across the tenant.",
    accent: "blue",
    capabilities: [
      { label: "Role & app review", detail: "Privileged roles, app registrations, consent grants" },
      { label: "Managed identity abuse", detail: "Token theft, key-vault and storage pivots" },
      { label: "Conditional access", detail: "Gap analysis against phishing-resistant policy" },
      { label: "Cross-tenant trust", detail: "B2B, guest, and federation boundary testing" },
    ],
    metrics: [
      { value: "6", label: "attack primitives" },
      { value: "AAD", label: "graph coverage" },
      { value: "0", label: "prod disruptions" },
    ],
  },
  {
    id: "hacking-web",
    kicker: "Web / API",
    title: "Web Exploitation",
    blurb:
      "Where business logic meets identity. Chaining access-control, injection, and logic flaws into demonstrable, high-impact compromise.",
    accent: "cyan",
    capabilities: [
      { label: "Access control", detail: "IDOR, broken authZ, privilege boundaries" },
      { label: "Server-side injection", detail: "SSRF, SQLi, template and deserialization" },
      { label: "Logic abuse", detail: "Race conditions, workflow and pricing bypass" },
      { label: "Token security", detail: "JWT, OAuth flows, session fixation" },
    ],
    metrics: [
      { value: "OWASP", label: "aligned methodology" },
      { value: "API", label: "+ GraphQL depth" },
      { value: "PoC", label: "for every finding" },
    ],
  },
];
