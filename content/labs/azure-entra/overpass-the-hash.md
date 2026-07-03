## Overview

OverPass-the-Hash (OPtH) converts a compromised NTLM hash into a Kerberos Ticket Granting Ticket (TGT) without knowing the account's plaintext password. Where Pass-the-Hash authenticates using NTLM directly, OPtH generates a legitimate Kerberos ticket — enabling access to resources that require Kerberos authentication and producing traffic that blends with normal domain auth patterns.

In hybrid environments, OPtH is the natural follow-on to DCSync: once hashes are extracted from AD replication, they can be converted to TGTs to move laterally without touching passwords or triggering password-related detection.

## How It Works

Standard Kerberos pre-authentication uses the account's key (derived from its password) to encrypt a timestamp sent to the KDC. With a known NTLM hash, that key is available directly — the hash *is* the RC4 encryption key. Tools that implement OPtH use this to request a TGT from the KDC on behalf of the account.

```
NTLM hash (RC4 key)
     ↓
AS-REQ to KDC: encrypt timestamp with RC4 key
     ↓
KDC validates → issues TGT for the account
     ↓
TGT injected into process token context
     ↓
Kerberos-authenticated access to any resource the account has permissions on
```

## Preconditions

| Requirement | Detail |
|---|---|
| NTLM hash of target account | Obtained via DCSync, SAM/LSASS dump, or gMSA derivation |
| Network access to DC on port 88 | KDC is required for TGT issuance |
| Target account is active | Disabled or locked accounts cannot obtain TGTs |

## Canonical Tools

**Rubeus** (Windows, purpose-built for Kerberos abuse):
```powershell
# Request TGT and inject into current session
.\Rubeus.exe asktgt /user:<USERNAME> /domain:<DOMAIN.CORP> /rc4:<NTLM_HASH> /dc:<DC-IP> /ptt

# Verify TGT is present
klist
```

**Impacket getTGT** (Linux/remote):
```bash
# Request TGT and save as .ccache file
python3 getTGT.py <DOMAIN>/<username> -hashes :<NTLM_HASH> -dc-ip <DC-IP>

# Use the TGT with other Impacket tools
export KRB5CCNAME=<username>.ccache
python3 psexec.py -k -no-pass <DOMAIN>/<username>@<TARGET>
```

**Mimikatz sekurlsa::pth** — opens a new process with the Kerberos context of the target account, enabling interactive use from a Windows session.

## High-Value Hash Targets

| Account | OPtH outcome |
|---|---|
| Domain Admin | Full domain access — SYSVOL, shares, RPC exec on any domain host |
| DC machine account (`DC$`) | Holds replication rights → enables DCSync from the new process |
| Service account | Access to whatever services and resources that account manages |
| krbtgt | Not directly useful for OPtH — use hash for Golden Ticket instead |

## Hybrid Context: Azure → AD Path

OPtH appears in hybrid chains when:
- Azure Arc Run Command on a domain-joined machine yields a machine account hash → OPtH as that machine → DCSync
- Password Writeback to a privileged AD account → lateral movement to host → hash extraction → OPtH
- Managed Identity on a domain-joined Azure VM compromised → LSASS access → OPtH

## Operator Notes

- OPtH using RC4 (NTLM hash) generates `4768` events with encryption type `0x17` (RC4-HMAC). In environments enforcing AES-only Kerberos, an RC4 TGT request is anomalous.
- The TGT is scoped to the requesting host's memory — it does not affect the account's actual Kerberos state elsewhere and does not change any AD object.
- A TGT obtained via OPtH is functionally identical to a legitimately obtained TGT — subsequent access events are indistinguishable from the account's normal activity.
- Use Rubeus `/ptt` (Pass-the-Ticket) to inject the TGT into the current session rather than opening a new process, to reduce process creation events visible to EDR.

## Detection / Friction Points

- Event `4768` (TGT request) with `EncryptionType: 0x17` (RC4) for an account that normally uses AES (`0x12`, `0x11`) is the primary signal.
- Microsoft Defender for Identity flags anomalous Kerberos encryption downgrade requests.
- New process spawned with a different security context from an existing session may appear in process creation logs — depends on whether `/pth` or `/ptt` approach is used.
- The technique requires network connectivity to the DC on Kerberos port 88 — expected from domain-joined hosts, potentially anomalous from non-domain infrastructure.
