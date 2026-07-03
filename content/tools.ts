/* Tools — personal offensive-security tooling. Backed by the public repo
   github.com/RicePattyJulls/tools; each script deep-links there. */

export type Tool = { name: string; detail: string; href: string };
export type ToolkitGroup = {
  name: string;
  lang: string;
  accent: "violet" | "blue" | "cyan";
  description: string;
  href: string;
  tools: Tool[];
};

const REPO = "https://github.com/RicePattyJulls/tools";

export const toolsMeta = {
  kicker: "Operator Utilities",
  title: "Tools",
  blurb:
    "Field-built offensive tooling, sharpened on real engagements. Three toolkits: an Active Directory recon/ACL-abuse baseline in PowerShell, an Entra ID / Azure abuse chain in PowerShell, and a pre-Burp web reconnaissance kit in Bash. Everything lives on GitHub.",
  repoUrl: REPO,
};

export const toolkits: ToolkitGroup[] = [
  {
    name: "Active Directory Toolkit",
    lang: "PowerShell",
    accent: "violet",
    description:
      "Standalone recon and ACL-abuse scripts for authorized AD engagements — local host baseline, credential hunting, domain-wide recon (ADSI or PowerView), dangerous-ACL sweeps, and targeted iterative enumeration for a specific user or host.",
    href: `${REPO}/tree/main/ACTIVE_DIRECTORY`,
    tools: [
      {
        name: "LOCAL_RECON.ps1",
        detail:
          "Local host security-control enumeration — WDAC, AppLocker, AMSI, Defender, UAC, LSA, Credential Guard, plus OS, network, sessions, and GETUID-style checks. No dependencies.",
        href: `${REPO}/blob/main/ACTIVE_DIRECTORY/LOCAL_RECON.ps1`,
      },
      {
        name: "CRED_HUNTING.ps1",
        detail:
          "Hunts PowerShell history, saved application credentials (RDP, PuTTY, WinSCP, VPNs), GPP cpassword in SYSVOL, and keyword sweeps across user folders.",
        href: `${REPO}/blob/main/ACTIVE_DIRECTORY/CRED_HUNTING.ps1`,
      },
      {
        name: "DOMAIN_RECON_BASELINE_ADSI.ps1",
        detail:
          "Full domain baseline via direct ADSI/LDAP — users, groups, hosts, password policy, GPOs, and forest information. No PowerView required.",
        href: `${REPO}/blob/main/ACTIVE_DIRECTORY/DOMAIN_RECON_BASELINE_ADSI.ps1`,
      },
      {
        name: "DOMAIN_RECON_BASELINE_Powerview.ps1",
        detail: "Same domain baseline as the ADSI version, built on PowerView cmdlets.",
        href: `${REPO}/blob/main/ACTIVE_DIRECTORY/DOMAIN_RECON_BASELINE_Powerview.ps1`,
      },
      {
        name: "DOMAIN_ACLS_BASELINE.ps1",
        detail:
          "Dangerous-ACL sweep across AdminSDHolder, GPOs, OUs, Tier 0 groups, DCs, LAPS, Shadow Credentials, and AD CS. Requires PowerView.",
        href: `${REPO}/blob/main/ACTIVE_DIRECTORY/DOMAIN_ACLS_BASELINE.ps1`,
      },
      {
        name: "DOMAIN_RECON_ITERATIVO.ps1",
        detail:
          "Targeted recon for a specific user/host — effective membership, lateral movement surface, and exploitable ACLs. Requires PowerView.",
        href: `${REPO}/blob/main/ACTIVE_DIRECTORY/DOMAIN_RECON_ITERATIVO.ps1`,
      },
      {
        name: "Enum-AD-ExploitableRights.ps1",
        detail:
          "No-PowerView exploitable-ACE/ACL hunter over System.DirectoryServices — OPSEC presets, identity filtering, GUID resolution, RBCD decoding, delegation enrichment, optional GPO SYSVOL ACL checks.",
        href: `${REPO}/blob/main/ACTIVE_DIRECTORY/Enum-AD-ExploitableRights.ps1`,
      },
    ],
  },
  {
    name: "Azure / Entra ID Toolkit",
    lang: "PowerShell",
    accent: "blue",
    description:
      "A sequential offensive Entra ID workflow — token acquisition feeds reconnaissance, reconnaissance feeds enumeration, and enumeration feeds authorized abuse. Each module takes tokens in and produces structured output for the next phase.",
    href: `${REPO}/tree/main/AZURE`,
    tools: [
      {
        name: "get_token.ps1",
        detail:
          "Multi-flow token acquisition for Graph, ARM, Key Vault, and Storage — DCF, ROPC, certificate, IMDS, and FOCI refresh-token pivots, with FOCI detection.",
        href: `${REPO}/blob/main/AZURE/scripts/get_token.ps1`,
      },
      {
        name: "recon.ps1",
        detail:
          "Tenant reconnaissance — map objects, search the local identity cache, and review authentication methods and Conditional Access policy.",
        href: `${REPO}/blob/main/AZURE/scripts/recon.ps1`,
      },
      {
        name: "entraId.ps1",
        detail:
          "Deep enumeration across users, service principals, groups, roles, PIM, and resources — the identity-analysis phase.",
        href: `${REPO}/blob/main/AZURE/scripts/entraId.ps1`,
      },
      {
        name: "ex_entraId.ps1",
        detail:
          "Authorized action modules — Key Vault and Storage access, PIM role activation, and identity modifications chained from enumeration context.",
        href: `${REPO}/blob/main/AZURE/scripts/ex_entraId.ps1`,
      },
    ],
  },
  {
    name: "Web PRE-BURP Toolkit",
    lang: "Bash",
    accent: "cyan",
    description:
      "Reconnaissance and surface triage before manual testing — passive discovery, alive-host verification, and technology-specific checks that turn signals into hypotheses before Burp.",
    href: `${REPO}/tree/main/WEB`,
    tools: [
      {
        name: "recon.sh",
        detail: "Passive subdomain discovery and alive-host verification.",
        href: `${REPO}/blob/main/WEB/recon.sh`,
      },
      {
        name: "triage.sh",
        detail: "Universal pre-Burp surface triage for a single target — 16 read-only checks.",
        href: `${REPO}/blob/main/WEB/triage.sh`,
      },
      {
        name: "TECH/ — Laravel",
        detail: "Laravel / Filament / Livewire surface checker — auth, Livewire, Horizon, Sanctum/Telescope/Nova.",
        href: `${REPO}/tree/main/WEB/TECH`,
      },
      {
        name: "TECH/ — Next.js",
        detail:
          "Next.js surface mapper and a signal-to-hypothesis converter (v1 + v2) — routes, JS chunks, sourcemaps, RSC, cache.",
        href: `${REPO}/tree/main/WEB/TECH`,
      },
      {
        name: "TECH/ — WordPress",
        detail:
          "WordPress component discovery plus a controlled WPScan triage wrapper (passive/vulns/deep, no brute force).",
        href: `${REPO}/tree/main/WEB/TECH`,
      },
      {
        name: "TECH/ — Spring Boot",
        detail: "Actuator surface checker — env/config secret leakage, beans, mappings, Jolokia, heapdump probe. Read-only.",
        href: `${REPO}/tree/main/WEB/TECH`,
      },
      {
        name: "TECH/ — Drupal",
        detail: "Fingerprint, JSON:API/REST, file exposure, and Drupalgeddon-class CVE-signal checks. Read-only.",
        href: `${REPO}/tree/main/WEB/TECH`,
      },
      {
        name: "TECH/ — Joomla",
        detail: "Admin surface, Web Services API misconfig (CVE-2023-23752), extensions, and version-correlated CVE signals.",
        href: `${REPO}/tree/main/WEB/TECH`,
      },
      {
        name: "TECH/ — Magento",
        detail: "Admin/REST/GraphQL surface, one bounded introspection query, Shoplift/CosmicSting CVE signals.",
        href: `${REPO}/tree/main/WEB/TECH`,
      },
      {
        name: "TECH/ — Atlassian",
        detail: "Jira / Confluence surface checker — auth, REST reachability, user-enum canary, gadget/CVE signals.",
        href: `${REPO}/tree/main/WEB/TECH`,
      },
      {
        name: "TECH/ — Qboxmail",
        detail: "Qboxmail panel surface auditor — passive, auth, controlled audit, and confirm-gated danger modules.",
        href: `${REPO}/tree/main/WEB/TECH`,
      },
      {
        name: "TECH/ — Cloud Storage",
        detail: "S3 / GCS / Azure Blob bucket exposure checker — bounded name permutations, listings never downloaded.",
        href: `${REPO}/tree/main/WEB/TECH`,
      },
      {
        name: "TECH/ — GraphQL",
        detail: "Generic GraphQL surface checker — discovery, introspection, CSRF, batching, field-suggestion leaks.",
        href: `${REPO}/tree/main/WEB/TECH`,
      },
      {
        name: "TECH/ — Infra Panels",
        detail: "Jenkins / Grafana / Kibana / phpMyAdmin / cPanel checker — reachability and misconfig, no code execution.",
        href: `${REPO}/tree/main/WEB/TECH`,
      },
    ],
  },
];
