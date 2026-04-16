export const adSections = {
  "credential-access": {
    "title": "Credential Access",
    "description": "Credential exposure paths that turn directory access, weak configuration, or residual secrets into reusable material.",
    "tag": "02 / Credential Access"
  },
  "delegation": {
    "title": "Delegation",
    "description": "Kerberos delegation abuse paths that let one service or identity act on behalf of another.",
    "tag": "03 / Delegation"
  },
  "domain-dominance": {
    "title": "Domain Dominance",
    "description": "Post-compromise techniques that convert privileged access, secrets, or ticket material into control over the domain.",
    "tag": "04 / Domain Dominance"
  },
  "trusts": {
    "title": "Trusts",
    "description": "Trust relationships, boundary conditions, and cross-forest abuse paths that matter once identity crosses its home domain.",
    "tag": "05 / Trusts"
  }
} as const;
export const adTechniques = [
  {
    "title": "AS-REP Roasting",
    "description": "Offline password cracking against users with Kerberos pre-authentication disabled.",
    "section": "credential-access",
    "order": 1,
    "eyebrow": "Credential Access",
    "tags": [
      "Kerberos",
      "Offline Cracking",
      "T1558.004"
    ],
    "summary": [
      "Targets accounts with DONT_REQ_PREAUTH enabled.",
      "Requests AS-REP material directly from the KDC.",
      "Converts a directory weakness into offline password recovery."
    ],
    "slug": "as-rep-roasting"
  },
  {
    "title": "GPP and SYSVOL Credential Exposure",
    "description": "Credential discovery through legacy GPP secrets, autologon values, and exposed logon scripts in SYSVOL.",
    "section": "credential-access",
    "order": 2,
    "eyebrow": "Credential Access",
    "tags": [
      "SYSVOL",
      "GPP",
      "Credential Hunting"
    ],
    "summary": [
      "Searches Group Policy Preferences for cpassword and related secrets.",
      "Reviews Registry.xml autologon material and script exposure.",
      "Treats SYSVOL as a low-noise source of reusable credentials."
    ],
    "slug": "gpp-and-sysvol-credential-exposure"
  },
  {
    "title": "Kerberoasting",
    "description": "Offline cracking of service account material obtained from TGS tickets tied to user-backed SPNs.",
    "section": "credential-access",
    "order": 3,
    "eyebrow": "Credential Access",
    "tags": [
      "Kerberos",
      "SPN",
      "T1558.003"
    ],
    "summary": [
      "Focuses on user-backed service accounts behind SPNs.",
      "Requests crackable TGS tickets for offline recovery.",
      "Maps service exposure to credential access and privilege growth."
    ],
    "slug": "kerberoasting"
  },
  {
    "title": "Kerberos Ticket Extraction",
    "description": "Operational recovery, reuse, and request flows for TGTs and service tickets from elevated Windows sessions.",
    "section": "credential-access",
    "order": 4,
    "eyebrow": "Credential Access",
    "tags": [
      "Kerberos",
      "Ticket Reuse",
      "LSA"
    ],
    "summary": [
      "Enumerates cached tickets from high-integrity contexts.",
      "Extracts TGTs or service tickets without raw LSASS dumping.",
      "Uses triage, dump, tgtdeleg, and asktgt flows depending on access."
    ],
    "slug": "kerberos-ticket-extraction"
  },
  {
    "title": "LAPS Abuse",
    "description": "Abuse paths created by weak Active Directory ACLs over LAPS-managed local administrator secrets.",
    "section": "credential-access",
    "order": 5,
    "eyebrow": "Credential Access",
    "tags": [
      "LAPS",
      "ACLs",
      "Local Admin"
    ],
    "summary": [
      "Treats LAPS as an ACL problem, not a broken feature.",
      "Converts directory read rights into local administrator access.",
      "Maps delegated permissions to host-level lateral movement."
    ],
    "slug": "laps-abuse"
  },
  {
    "title": "PASSWD_NOTREQD Abuse",
    "description": "Assessment of accounts that do not require a password and the risk introduced by weak identity hygiene.",
    "section": "credential-access",
    "order": 6,
    "eyebrow": "Credential Access",
    "tags": [
      "UAC Flags",
      "Identity Hygiene",
      "Authentication"
    ],
    "summary": [
      "Hunts for accounts configured with PASSWD_NOTREQD.",
      "Validates whether the flag translates into real abuse.",
      "Separates misleading directory state from exploitable authentication."
    ],
    "slug": "passwd-notreqd"
  },
  {
    "title": "Reversible Password Storage",
    "description": "Detection and exploitation context for accounts configured to store passwords using reversible encryption.",
    "section": "credential-access",
    "order": 7,
    "eyebrow": "Credential Access",
    "tags": [
      "Password Storage",
      "UAC Flags",
      "NTDS"
    ],
    "summary": [
      "Identifies accounts with reversible password storage enabled.",
      "Connects directory configuration to cleartext credential recovery.",
      "Frames the setting as a direct expansion of post-exploitation value."
    ],
    "slug": "reversible-passwords"
  },
  {
    "title": "Unconstrained Delegation",
    "description": "Abuse of hosts or users trusted for unconstrained delegation to capture and replay delegated TGT material.",
    "section": "delegation",
    "order": 1,
    "eyebrow": "Delegation",
    "tags": [
      "Kerberos",
      "Delegation",
      "T1558"
    ],
    "summary": [
      "Identifies systems trusted to receive delegated TGTs automatically.",
      "Converts inbound authentication to reusable Kerberos material.",
      "Favors coercion or passive capture against privileged identities."
    ],
    "slug": "unconstrained-delegation"
  },
  {
    "title": "Constrained Delegation",
    "description": "S4U-based impersonation abuse when a service is allowed to delegate to specific back-end SPNs.",
    "section": "delegation",
    "order": 2,
    "eyebrow": "Delegation",
    "tags": [
      "S4U",
      "KCD",
      "Kerberos"
    ],
    "summary": [
      "Maps services with msDS-AllowedToDelegateTo populated.",
      "Uses S4U2Self and S4U2Proxy to impersonate target users.",
      "Turns delegated service rights into controlled lateral movement."
    ],
    "slug": "constrained-delegation"
  },
  {
    "title": "Resource-Based Constrained Delegation (RBCD)",
    "description": "ACL-driven delegation abuse through msDS-AllowedToActOnBehalfOfOtherIdentity on target computer objects.",
    "section": "delegation",
    "order": 3,
    "eyebrow": "Delegation",
    "tags": [
      "RBCD",
      "ACLs",
      "S4U"
    ],
    "summary": [
      "Shifts delegation control to the target resource.",
      "Abuses write rights over computer objects to authorize attacker-controlled identities.",
      "Projects impersonation without stealing the target user password."
    ],
    "slug": "rbcd"
  },
  {
    "title": "Shadow Credentials",
    "description": "Persistence and privilege projection through KeyCredentialLink abuse and PKINIT-based authentication.",
    "section": "domain-dominance",
    "order": 1,
    "eyebrow": "Domain Dominance",
    "tags": [
      "PKINIT",
      "msDS-KeyCredentialLink",
      "Persistence"
    ],
    "summary": [
      "Attaches attacker-controlled key material to a target identity.",
      "Enables certificate-style logon without the original password.",
      "Bridges object-control abuse with durable identity takeover."
    ],
    "slug": "shadow-credentials"
  },
  {
    "title": "DPAPI Backup Key",
    "description": "Domain-level recovery and decryption of DPAPI-protected material using the forest backup key.",
    "section": "domain-dominance",
    "order": 2,
    "eyebrow": "Domain Dominance",
    "tags": [
      "DPAPI",
      "Secrets Recovery",
      "Domain Control"
    ],
    "summary": [
      "Treats the DPAPI backup key as a strategic domain secret.",
      "Decrypts protected user and machine material at scale.",
      "Expands compromise into browser, vault, and stored credential recovery."
    ],
    "slug": "dpapi-backup-key"
  },
  {
    "title": "DCSync",
    "description": "Directory replication abuse to recover password material directly from a Domain Controller over replication rights.",
    "section": "domain-dominance",
    "order": 3,
    "eyebrow": "Domain Dominance",
    "tags": [
      "Replication Rights",
      "KRBTGT",
      "T1003.006"
    ],
    "summary": [
      "Abuses Replicating Directory Changes rights instead of DC code execution.",
      "Retrieves krbtgt and privileged account material remotely.",
      "Acts as a clean bridge from ACL abuse to full domain dominance."
    ],
    "slug": "dcsync"
  },
  {
    "title": "Silver Ticket",
    "description": "Forgery of service tickets using a service account key to access a specific SPN without consulting the KDC.",
    "section": "domain-dominance",
    "order": 4,
    "eyebrow": "Domain Dominance",
    "tags": [
      "Kerberos Forgery",
      "Service Tickets",
      "T1558.002"
    ],
    "summary": [
      "Uses a service key to forge a valid-looking TGS offline.",
      "Targets one service boundary rather than the entire domain.",
      "Works best when the service validates locally instead of at the KDC."
    ],
    "slug": "silver-ticket"
  },
  {
    "title": "Golden Ticket",
    "description": "Full TGT forgery using the krbtgt secret to mint arbitrary identities and request service access across the domain.",
    "section": "domain-dominance",
    "order": 5,
    "eyebrow": "Domain Dominance",
    "tags": [
      "KRBTGT",
      "TGT Forgery",
      "T1558.001"
    ],
    "summary": [
      "Requires compromise of the krbtgt secret.",
      "Forges arbitrary TGTs and group membership data.",
      "Transforms domain compromise into durable identity fabrication."
    ],
    "slug": "golden-ticket"
  },
  {
    "title": "Diamond Ticket",
    "description": "Modification of a legitimate TGT to preserve realistic ticket structure while injecting attacker-controlled privilege data.",
    "section": "domain-dominance",
    "order": 6,
    "eyebrow": "Domain Dominance",
    "tags": [
      "Kerberos Forgery",
      "PAC Tampering",
      "T1558"
    ],
    "summary": [
      "Starts from a real ticket instead of generating one from zero.",
      "Preserves a more realistic PAC and ticket shape.",
      "Blends forged privilege with legitimate ticket issuance context."
    ],
    "slug": "diamond-ticket"
  },
  {
    "title": "Skeleton Key",
    "description": "Domain Controller memory tampering that introduces a master password across the domain authentication flow.",
    "section": "domain-dominance",
    "order": 7,
    "eyebrow": "Domain Dominance",
    "tags": [
      "Domain Controller",
      "Authentication Backdoor",
      "Mimikatz"
    ],
    "summary": [
      "Requires high privilege on a Domain Controller.",
      "Injects a universal backdoor password into authentication processing.",
      "Represents direct runtime compromise of the domain trust anchor."
    ],
    "slug": "skeleton-key"
  },
  {
    "title": "Forest and Domain Trusts Fundamentals",
    "description": "Operational model for trust direction, SID filtering, authentication flow, and cross-domain authorization boundaries.",
    "section": "trusts",
    "order": 1,
    "eyebrow": "Trusts",
    "tags": [
      "Trusts",
      "SID Filtering",
      "Cross-Forest"
    ],
    "summary": [
      "Explains trust types, propagation, and real security boundaries.",
      "Separates authentication from authorization across domain links.",
      "Anchors later abuse paths involving FSPs, ExtraSIDs, and PAM."
    ],
    "slug": "forest-and-domain-trusts"
  },
  {
    "title": "PAM Trust",
    "description": "Shadow Principal and bastion-forest privilege projection in Microsoft PAM / PIM trust designs.",
    "section": "trusts",
    "order": 2,
    "eyebrow": "Trusts",
    "tags": [
      "PAM",
      "Shadow Principals",
      "Bastion Forest"
    ],
    "summary": [
      "Shows how privilege can cross forests as authorization rather than identity.",
      "Maps Shadow Security Principals to real production impact.",
      "Treats the bastion forest as a new power center, not a shield."
    ],
    "slug": "pam-trust"
  },
  {
    "title": "Inbound Trust FSP Referral Ticket Abuse",
    "description": "Abuse chain based on Foreign Security Principals and inbound trust relationships to forge usable referral material.",
    "section": "trusts",
    "order": 3,
    "eyebrow": "Trusts",
    "tags": [
      "FSP",
      "Inbound Trust",
      "Referral Tickets"
    ],
    "summary": [
      "Starts from target-side ACLs that reference external SIDs.",
      "Maps FSP objects back to real source-domain groups.",
      "Turns trust recognition into controlled cross-domain privilege."
    ],
    "slug": "inbound-trust-fsp-referral-ticket-abuse"
  },
  {
    "title": "Outbound Trust Abuse",
    "description": "Cross-domain interaction using outbound trust keys, TDO material, and direct TGT acquisition against the trusted side.",
    "section": "trusts",
    "order": 4,
    "eyebrow": "Trusts",
    "tags": [
      "TDO",
      "Trust Keys",
      "Cross-Domain"
    ],
    "summary": [
      "Treats the trust account as a visibility and interaction primitive.",
      "Pulls current trust keys from the TDO for remote ticket requests.",
      "Shifts the conversation from trust direction to what the key unlocks."
    ],
    "slug": "outbound-trust-abuse"
  },
  {
    "title": "Golden and Diamond Ticket Abuse Across Trusts",
    "description": "Ticket forgery and SIDHistory projection across intra-forest and trust-linked environments.",
    "section": "trusts",
    "order": 5,
    "eyebrow": "Trusts",
    "tags": [
      "ExtraSIDs",
      "SIDHistory",
      "Trust Abuse"
    ],
    "summary": [
      "Extends forged-ticket operations across trusted boundaries.",
      "Focuses on intra-forest and misconfigured SID-filtering scenarios.",
      "Connects krbtgt compromise to forest-level privilege projection."
    ],
    "slug": "trust-ticket-forgery"
  }
] as const;

export const adTechniquesBySection = Object.fromEntries(
  Object.keys(adSections).map((key) => [key, adTechniques.filter((item) => item.section === key)])
) as Record<keyof typeof adSections, typeof adTechniques>;

export const adTechniquesBySlug = Object.fromEntries(
  adTechniques.map((item) => [item.slug, item])
) as Record<(typeof adTechniques)[number]['slug'], (typeof adTechniques)[number]>;
