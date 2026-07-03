export const chainSections = {
  "tenant-compromise": {
    "title": "Black-Box to Tenant Compromise",
    "description": "Full engagements chained from a public entry point to complete control of an organization's tenant — real, reported, and sanitized for publication.",
    "tag": "01 / Black-Box to Tenant Compromise"
  }
} as const;

export const attackChains = [
  {
    "title": "Public Registration to Full Mail-Tenant Takeover",
    "description": "An anonymous public signup flow turned into a functional tenant identity, chained through user enumeration and a provider-panel BOLA into full administrative mailbox takeover.",
    "section": "tenant-compromise",
    "order": 1,
    "eyebrow": "Black-Box to Tenant Compromise",
    "tags": [
      "BOLA",
      "IDOR",
      "Account Takeover",
      "JWT",
      "Signup Abuse"
    ],
    "summary": [
      "Turns an unverified public signup into a functional internal tenant identity.",
      "Enumerates real users and maps a hidden provider admin panel from vhost fuzzing and its own JS bundle.",
      "Exploits a BOLA to overwrite the postmaster's password from a zero-privilege session — full tenant takeover."
    ],
    "slug": "public-signup-to-tenant-takeover"
  }
] as const;

export type AttackChain = (typeof attackChains)[number];

export const chainsBySection = Object.fromEntries(
  Object.keys(chainSections).map((key) => [
    key,
    attackChains.filter((item) => item.section === key),
  ]),
) as Record<keyof typeof chainSections, AttackChain[]>;

export const chainsBySlug = Object.fromEntries(
  attackChains.map((item) => [item.slug, item]),
) as Record<string, AttackChain>;
