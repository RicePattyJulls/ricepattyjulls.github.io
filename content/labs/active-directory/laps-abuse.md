
> LAPS is not “broken.” It is abused when Active Directory is misconfigured. Its strength depends entirely on AD ACLs and trust in SYSTEM.

- [ ] What LAPS Is (General Model)

LAPS is Microsoft's solution for automatically managing **local administrator account passwords** on domain-joined hosts where the corresponding GPO is applied. It enforces periodic rotation, prevents password reuse between hosts, and stores the secret in Active Directory under ACL control.

Common characteristics:

- The local administrator password is stored in Active Directory and linked to the computer object.
- Access to the secret is controlled exclusively through AD ACLs.
- The secret may be stored in cleartext or encrypted, depending on the LAPS version.
- Rotation logic runs on the endpoint.
- The process runs as SYSTEM.

> LAPS does not protect the AD secret itself. It protects **access** to that secret through ACLs.

- [ ] LAPS Variants

| Aspect | Classic LAPS | Windows LAPS |
| --- | --- | --- |
| Year | ~2015 | 2023+ |
| Integration | Add-on | Built into Windows |
| AD attribute | `ms-mcs-admpwd` | `msLAPS-Password` |
| Protection | AD ACLs | ACLs + Extended Rights |
| Encryption in AD | ❌ No | ✅ Optional |
| Client | `AdmPwd.dll` | Built into the OS |
| Execution context | SYSTEM | SYSTEM |
| Risk model | ACL + SYSTEM | ACL + SYSTEM |
| Security philosophy | Same | Same |

> Windows LAPS changes the attribute and hardens controls, but it does not change the threat model.

- [ ] Internal Operation (High Level)

1. At each GPO refresh, the LAPS client on the host checks whether the local administrator password has expired according to policy.
2. If it has expired (30 days by default), the host generates a new password based on the configured policy (length, complexity, character set).
3. The entire process runs under SYSTEM on the endpoint.
4. SYSTEM writes the password, cleartext or encrypted depending on the version, into the LAPS attribute on the `computer` object in Active Directory using that object's SELF rights.
5. Active Directory does not generate or rotate the password. It only stores the secret and applies ACLs to decide who can read it.

> SYSTEM is an implicit trusted principal in the LAPS model.

- [ ] Where the Real Risk Lives

- Who can read the password attribute on the computer object
- Who can modify the ACLs of the object or its OU
- Who can act as SYSTEM on the endpoint

> If you can read the attribute, LAPS is effectively broken for that host.

LAPS mitigates password reuse between local administrator accounts, but it does not protect against an attacker with local SYSTEM control or against an attacker with strong administrative rights in the domain. It trusts the integrity of code running as SYSTEM on the endpoint and it trusts AD ACLs to protect the secret.

1. SYSTEM can modify `ms-mcs-admpwd` and `ms-mcs-admpwdexpirationtime` on LAPS-managed computers. That means a SYSTEM-level attacker can extend or pin the expiration time indefinitely.
2. With Domain Admin rights, an attacker can modify ACLs on computer objects and grant controlled users read access to LAPS passwords in cleartext.
3. In classic LAPS, the client component `AdmPwd.dll` (default path: `C:\Program Files\LAPS\CSE\`) does not enforce integrity checking and can be replaced with a malicious version to:
   - set known passwords
   - extend expiration indefinitely
   - exfiltrate credentials

- [ ] Enumeration: LAPS Classic and Windows LAPS Delegations on OUs and Computer Objects

```powershell
$$targetDomain = "domain.local"
$dn=(($targetDomain -split '\.')|%{"DC=$_"})-join','; $dc=(Resolve-DnsName -Type SRV ("_ldap._tcp.dc._msdcs.$targetDomain") -EA SilentlyContinue | sort Priority,Weight | select -First 1 -ExpandProperty NameTarget).TrimEnd('.'); function RSID($sid){ try{ $o=New-Object System.Security.Principal.SecurityIdentifier($sid); try{$o.Translate([System.Security.Principal.NTAccount]).Value}catch{ try{ $r=[ADSI]"LDAP://$dc/<SID=$sid>"; if($r.distinguishedName){$r.distinguishedName}else{$sid} }catch{$sid} } }catch{$sid} }; (Get-DomainOU -Domain $targetDomain | %{$_.DistinguishedName}) + (Get-DomainComputer -Domain $targetDomain | %{$_.DistinguishedName}) | %{$obj=$_; Get-DomainObjectAcl -Domain $targetDomain -Identity $obj -ResolveGUIDs | % { $_ | Add-Member NoteProperty Identity (RSID $_.SecurityIdentifier) -Force -PassThru } | ?{ $_.ObjectAceType -match "ms-Mcs-AdmPwd|ms-Mcs-AdmPwdExpirationTime|msLAPS-Password|msLAPS-PasswordExpirationTime" -and $_.Identity -notmatch "Domain Admins|Enterprise Admins|SYSTEM|Administrators" } | select @{n="Object";e={$obj}},Identity,SecurityIdentifier,ActiveDirectoryRights,ObjectAceType,ObjectDN } | sort Object,Identity -Unique
```

- [ ] Abuse

```powershell
import-module .\Get-LAPSPasswords.ps1
Get-LAPSPasswords
Get-LAPSPasswords -Computer host_name
# password
```