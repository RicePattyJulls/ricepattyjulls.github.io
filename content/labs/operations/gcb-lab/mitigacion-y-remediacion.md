## 1. ACLs & PRIVILEGE CONTROL

> No se deben eliminar ACEs completas sin analizar su impacto, ya que podría afectar access legítimos; en su lugar, se debe modificar only el permiso abusivo, manteniendo la funcionalidad necesaria del sistema y validando siempre los cambios en memoria, directamente en Active Directory y via una fuente independiente para asegurar su correcta aplicación.

- Los permissions definidos en `ActiveDirectoryRights` (bitmask) pueden ser modificados directamente via operaciones binarias.
- Los permissions específicos definidos por `ObjectType` (GUID) no pueden ajustarse only con bitmask y requieren tratamiento adicional.
- Si la ACE abusiva es heredada (`IsInherited = True`), no debe corregirse directamente en el objeto hijo; la remediation debe aplicarse en el objeto padre desde el que se hereda.

#### Definición del objeto target ($Identity)

```powershell
# USER
$Identity=(Get-ADUser "user").DistinguishedName

# GROUP
$Identity=(Get-ADGroup "group").DistinguishedName

# COMPUTER
$Identity=(Get-ADComputer "host").DistinguishedName

# OU
$Identity=(Get-ADOrganizationalUnit -Filter 'Name -eq "Microsoft Exchange Security Groups"').DistinguishedName

# DOMAIN
$Identity=(Get-ADDomain).DistinguishedName

# CONFIGURATION OBJECT (FOREST LEVEL)
$Identity="CN=Shadow Principal Configuration,CN=Services,CN=Configuration,DC=domain,DC=local"
```

- `$Identity=...`: Define el objeto target en AD sobre el cual se realizará la remediation (user, group, computer, OU o domain)
- Se obtiene el `DistinguishedName`, necesario para interactuar con su ACL

#### Identificación de permissions abusivos ($acl_delete) — ActiveDirectoryRights

```powershell
$acl_delete="GenericAll"
$acl_delete="GenericWrite"
$acl_delete="GenericRead"
$acl_delete="GenericExecute"

$acl_delete="WriteProperty"
$acl_delete="ReadProperty"

$acl_delete="WriteDacl"
$acl_delete="WriteOwner"

$acl_delete="CreateChild"
$acl_delete="DeleteChild"
$acl_delete="DeleteTree"

$acl_delete="ListChildren"
$acl_delete="ListObject"

$acl_delete="Delete"
$acl_delete="ReadControl"
```

- Estos permissions forman parte de `ActiveDirectoryRights`
- Son combinables y pueden eliminarse parcialmente via operaciones de bitmask
- Aplican a ACEs sin dependencia de `ObjectType`

#### Identificación de permissions abusivos ($acl_delete) — ObjectType (GUID)

```powershell
# Ejemplos comunes (Extended Rights / atributos específicos)

# DCSync
$guid_delete="1131f6aa-9c07-11d1-f79f-00c04fc2dcd2" # Replicating Directory Changes
$guid_delete="1131f6ad-9c07-11d1-f79f-00c04fc2dcd2" # Replicating Directory Changes All
$guid_delete="89e95b76-444d-4c62-991a-0facbeda640c" # Replicating Directory Changes In Filtered Set

# Allowed-To-Authenticate
$guid_delete="68b1d179-0d15-4d4f-ab71-46152e79a7bc"

# Reset Password
$guid_delete="00299570-246d-11d0-a768-00aa006e0529"

# Write Members / Self-Membership
$guid_delete="bf9679c0-0de6-11d0-a285-00aa003049e2"
# ⚠️ El GUID de member es el mismo; la diferencia práctica is en la ACE (WriteProperty / Self) y en cómo se concede el abuso sobre la membresía del grupo.
```

- Estos GUID representan permissions específicos ligados a atributos o extended rights
- No pueden eliminarse only con bitmask (`ActiveDirectoryRights`), ya que dependen del campo `ObjectType`
- Es necesario identificar exactamente el GUID presente en la ACE

#### Definición de la identidad a eliminar ($principal)

```powershell
# USER
$principal=(Get-ADUser "user").SID.value

# GROUP
$principal=(Get-ADGroup "Organization Management").SID.value

# COMPUTER
$principal=(Get-ADComputer "host").SID.value
```

### Basados en ActiveDirectoryRights

> El target es eliminar el permiso definido en `$acl_delete` de la identidad `$principal` sobre el objeto `$Identity`, evitando su explotación y preservando la integridad y control del mismo via la aplicación del principio de mínimo privilegio.

1. Cargar ACL actual del objeto en memoria

```powershell
$acl=Get-Acl "AD:$Identity"
```

2. Remediation: Se identifica la ACE asociada al main que contiene el permiso abusivo. 

> En lugar de eliminar la ACE completa (lo cual puede romper acceso legítimo), se reconstruye la ACE eliminando only el derecho específico → Enfoque basado en mínimo privilegio  

Caso 1: `GenericAll + ReadProperty` → tras remediation queda `ReadProperty` (se conserva acceso legítimo)

```powershell
$acl.Access | ?{
($_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value) -eq $principal
} | %{
    if($_.ActiveDirectoryRights -band [System.DirectoryServices.ActiveDirectoryRights]::$acl_delete){
        $right=[System.DirectoryServices.ActiveDirectoryRights]::$acl_delete
        $newRights=$_.ActiveDirectoryRights -band (-bnot $right)
        $acl.RemoveAccessRuleSpecific($_)
        if($newRights -ne 0){
            $newAce=New-Object System.DirectoryServices.ActiveDirectoryAccessRule(
                $_.IdentityReference,
                $newRights,
                $_.AccessControlType,
                $_.ObjectType,
                $_.InheritanceType,
                $_.InheritedObjectType
            )
            $acl.AddAccessRule($newAce)
        }
    }
}
```

Caso 2: `GenericAll` → tras remediation queda vacío (la ACE se elimina completamente y no se reconstruye)

```powershell
$acl.Access|?{($_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value)-eq $principal -and ($_.ActiveDirectoryRights -band [System.DirectoryServices.ActiveDirectoryRights]::$acl_delete)}|%{$acl.RemoveAccessRuleSpecific($_)}
```

Caso 3: Elimina todos los ACE explícitos (I`sInherited = False`) asociados al main indicado, removiendo permissions asignados directamente sobre el objeto sin afectar la herencia

```powershell
$acl.Access|?{($_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value)-eq $principal -and $_.IsInherited -eq $false}|%{$acl.RemoveAccessRuleSpecific($_)}
```

3. Comprobación en memoria

```powershell
$acl.Access | ?{($_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value) -eq $principal } | select IdentityReference,ActiveDirectoryRights,ObjectAceType,IsInherited | fl
```

4. Aplicación de cambios

```powershell
# MODULO AD
Set-Acl -AclObject $acl -Path "AD:$Identity"
```

5. Confirmación

```powershell
(Get-Acl "AD:$Identity").Access | ?{($_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value) -eq $principal}

# PowerView
Get-DomainObjectAcl -Identity $Identity -ResolveGUIDs | % { $_ | Add-Member NoteProperty Identity (ConvertFrom-SID $_.SecurityIdentifier) -Force -PassThru } | ? { $_.SecurityIdentifier -eq $principal } | select Identity,SecurityIdentifier,ActiveDirectoryRights,ObjectAceType,ObjectDN,IsInherited,AceFlags,PropagationFlags | fl
```

> Que permissions tiene `$principal` sobre `$Identity`

#### Conceptos clave

- `$principal="ITEmployeesUsers"`: Identidad (user/group) cuyos permissions serán ajustados
- `$acl_delete`: Permiso específico a eliminar (ej: `WriteProperty`, `GenericWrite`)
- `$acl=Get-Acl`: Obtiene el Security Descriptor completo del objeto
- `$acl.Access`: Contiene todas las ACEs (Access Control Entries)
- `RemoveAccessRuleSpecific`: Elimina la ACE exacta antes de reconstruirla
- `Set-Acl`: Persiste los cambios en Active Directory

### Basados en ObjectType (GUID)

> El target es eliminar una ACE específica basada en `ObjectType` (GUID), ya que este tipo de permissions no puede ajustarse parcialmente. En este caso, se elimina la ACE completa que contiene el GUID abusivo, asegurando que no persista la capacidad crítica (ej: DCSync), manteniendo el resto de permissions intactos.

```powershell
# Cargar ACL
$acl=Get-Acl "AD:$Identity"

# Remediation (GUID + principal)
$acl.Access|?{($_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value)-eq $principal -and $_.ObjectType -eq $guid_delete}|%{$acl.RemoveAccessRuleSpecific($_)}

# Comprobación
$acl.Access|?{($_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value) -eq $principal}|select IdentityReference,ActiveDirectoryRights,ObjectType,IsInherited

# Aplicación de cambios
Set-Acl -AclObject $acl -Path "AD:$Identity"

# Confirmación
(Get-Acl "AD:$Identity").Access|?{($_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value) -eq $principal}

# PowerView
Get-DomainObjectAcl -Identity $Identity -ResolveGUIDs | % { $_ | Add-Member NoteProperty Identity (ConvertFrom-SID $_.SecurityIdentifier) -Force -PassThru } | ? { $_.SecurityIdentifier -eq $principal } | select Identity,SecurityIdentifier,ActiveDirectoryRights,ObjectAceType,ObjectDN,IsInherited,AceFlags,PropagationFlags | fl
```

## 2. IDENTITY HARDENING

#### Implementar modelo de administración por niveles:


| Tier   | Qué es                             | Cuentas permitidas                                                                        | Activos incluidos                                                             | NO permitido                                              | Regla clave               |
| ------ | ---------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------- |
| Tier 0 | Control total del domain / forest | Domain Admins, Enterprise Admins, Admins de DC, accounts dedicadas (`adm-dc-*`)            | Domain Controllers, AD CS, ADFS / PKI, AdminSDHolder, objetos críticos        | Usuarios normales, service accounts, accounts reutilizadas | Solo logon en DCs         |
| Tier 1 | Infraestructura (servidores)       | Admins de servidores (`adm-srv-*`), service accounts, accounts de apps (SQL, IIS, backups) | Servidores (SQL, IIS, apps), servicios, tareas programadas, AV/monitorización | Domain Admins, accounts Tier 0                             | No escalar a Tier 0       |
| Tier 2 | Entorno de user                 | Usuarios normales, helpdesk, accounts estándar, admins locales (`adm-wks-*`)               | Workstations, navegación web, email                                          | Acceso a servidores críticos, credentials Tier 0/1       | Aislar de Tier 1 y Tier 0 |

- Tier 2 → compromised = normal
- Tier 1 → peligroso
- Tier 0 → game over

#### Restringir autenticación interactiva (GPO)

> Convertir la account `user` en no interactiva, bloqueando cualquier tipo de inicio de session (local, RDP o red). Solo debe aplicarse si la account no requiere acceso interactivo para su funcionamiento (ej. accounts de servicio)

```powershell
# =========================================
# EXPORTAR CONFIGURACIÓN ACTUAL
# =========================================
# Extrae la política local de seguridad para edición
secedit /export /cfg C:\temp\secpol.cfg

# =========================================
# EDITAR CONFIGURACIÓN
# =========================================
# Abrir archivo y modificar las siguientes líneas:
notepad C:\temp\secpol.cfg

# Denegar inicio de session local (consola)
# SeDenyInteractiveLogonRight = user

# Denegar inicio de session remoto vía RDP
# SeDenyRemoteInteractiveLogonRight = user

# Denegar acceso desde red (SMB, WinRM, etc.)
# SeDenyNetworkLogonRight = user

# Denegar ejecución como servicio
# SeDenyServiceLogonRight = user

# Denegar ejecución como batch (scheduled tasks)
# SeDenyBatchLogonRight = user

# =========================================
# APLICAR CAMBIOS
# =========================================
# Reimporta la configuración modificada al sistema
secedit /configure /db C:\windows\security\local.sdb /cfg C:\temp\secpol.cfg /areas USER_RIGHTS
```

#### Eliminación de membresía en groups (Domain / Local / Remoto) ~  aplica principio de mínimo privilegio

```powershell
# Enumearr memberias de grupos
Get-ADGroupMember -Identity "GROUP_NAME" | select SamAccountName

# Domain → eliminar user de grupo de AD
Remove-ADGroupMember -Identity "GROUP_NAME" -Members "USER_NAME" -Confirm:$false

# Domain remoto
$sid="S-1-5-21-X-X-X-X"
$user=Get-ADUser -Identity $sid -Server remote.example
Remove-ADGroupMember -Identity "GROUP_NAME" -Members $user -Server remote.example -Confirm:$false

# Verificación (domain)
Get-ADGroupMember -Identity "GROUP_NAME" | select SamAccountName
net group "GROUP_NAME" /domain

# Local → eliminar user de grupo local
Remove-LocalGroupMember -Group "GROUP_NAME" -Member "DOMAIN\USER_NAME"

# Verificación (local)
net localgroup "GROUP_NAME"

# Domain remoto → eliminar membresía vía ADSI (cuando no hay confianza o módulo AD no disponible)
$group=[ADSI]"LDAP://remote.example/CN=GROUP_NAME,CN=Users,DC=remote,DC=local"; $group.Remove("LDAP://<SID=$sid>"); $group.CommitChanges()

# Verificación (remoto)
Get-ADGroupMember -Identity "GROUP_NAME" -Server remote.example

#  Eliminar users añadidos al Shadow Principal
Get-ADUser user | select DistinguishedName
Set-ADObject -Identity "CN=domain-ShadowEnterpriseAdmin,CN=Shadow Principal Configuration,CN=Services,CN=Configuration,DC=domain,DC=local" -Remove @{'member'="CN=user,CN=Users,DC=domain,DC=local"}

# Verificar
$conf=(Get-ADRootDSE).configurationNamingContext
Get-ADObject -SearchBase "CN=Shadow Principal Configuration,CN=Services,$conf" -LDAPFilter "(objectClass=msDS-ShadowPrincipal)" -Properties member | select Name,member

# Revisar otros Shadows Security Principals
Get-ADObject -LDAPFilter "(objectClass=msDS-ShadowPrincipal)" -SearchBase (Get-ADRootDSE).configurationNamingContext -Properties member | % { [pscustomobject]@{Name=$_.Name;Members=$_.member} }

# Delegar solo lo necesario en OU (ejemplo)
dsacls "OU=ServiceAccounts,DC=internalmsp,DC=local"
```

- `dsacls`: Muestra el descriptor de seguridad (ACL) del objeto en AD
- Permite ver qué users/groups tienen permissions (ej: GenericAll, Write, etc.) sobre la OU
- Se usa para auditar delegaciones existentes y detectar permissions excesivos antes de ajustarlos al mínimo necesario

> “Active Directory on-prem no implementa expiración automática de membresías en objetos `msDS-ShadowPrincipal`, por lo que el modelo Just-In-Time (JIT) debe ser implementado via procesos operativos o automatización externa que garanticen la revocación oportuna del acceso.”

#### Revisar y restringir administración de Shadow Principals (PAM)

> Los objetos msDS-ShadowPrincipal deben estar limitados a identidades estrictamente autorizadas, ya que permiten mapear privileges elevados entre domains o forests.

- Revisar miembros actuales de cada Shadow Principal
- Eliminar asignaciones no justificadas
- Restringir quién puede modificar objetos en CN=Shadow Principal Configuration
- Validar que no existan mapeos directos innecesarios towards roles críticos (ej. Enterprise Admins)

#### Reconfiguración de privileges locales (mínimo privilegio)

```powershell
# Agregar al grupo Remote Management Users (allows acceso remoto controlado sin privileges de admin)
net localgroup "Remote Management Users" user /add

# Eliminar al user del grupo Administrators (revoca privileges administrativos locales) 
net localgroup Administrators user /delete
```

> ⚠️ Nota: Although this configuración reduce privileges, no es recomendable por sí sola en escenarios donde se requiere ejecución remota, ya que puede eliminar la capacidad de autorización necesaria para herramientas como WinRM (`winrs`). En su lugar, es preferible implementar un endpoint JEA (Just Enough Administration), que allows definir de forma granular qué comandos puede ejecutar el user sin otorgarle privileges administrativos completos.

#### Proteger accounts privilegiadas (Protected Users) ~ Protege autenticación

> Qué sana: evita que credentials privilegiadas sean reutilizadas o abusadas en ataques comunes  
> Bloquea: delegation, NTLM fallback, uso indebido de tickets (pass-the-ticket / pass-the-hash)

> Protected Users endurece el uso de credentials privilegiadas, pero no sustituye la corrección de ACLs, delegaciones indebidas o permissions de replicación ya otorgados.

```powershell
# Añadir users específicos
Add-ADGroupMember "Protected Users" -Members Administrator
Add-ADGroupMember "Protected Users" -Members "appmanager"

# Añadir grupos privilegiados completos
Get-ADGroupMember "Domain Admins" | % { Add-ADGroupMember "Protected Users" -Members $_ -ErrorAction SilentlyContinue }
Get-ADGroupMember "Enterprise Admins" | % { Add-ADGroupMember "Protected Users" -Members $_ -ErrorAction SilentlyContinue }

# Verificar miembros
Get-ADGroupMember "Protected Users" | select SamAccountName

# Eliminar user (si es necesario)
Remove-ADGroupMember "Protected Users" -Members "appmanager" -Confirm:$false
```

> Requiere Kerberos moderno (`AES256`). No compatible con NTLM ni sistemas legacy.
 
#### Proteger el grupo (AdminSDHolder) ~ Protege autorización

> Qué sana: evita que permissions críticos sobre accounts/groups privilegiados sean modificados o heredados incorrectamente  
> Bloquea: cambios persistentes de ACL (ej: `GenericAll`, `WriteDacl`) sobre accounts Tier 0

> AdminSDHolder protege objetos privilegiados frente a herencia insegura, pero no corrige por sí only permissions abusivos ya existentes sobre el domain, OUs críticas o groups delegados.

```powershell
Set-ADGroup GROUP_NAME -AdminCount 1
```

> Esto aplica el modelo AdminSDHolder, protegiendo el objeto y deshabilitando herencia de permissions

#### Eliminar passwords en descripciones

```powershell
Set-ADUser vaultdbadmin -Description ""
```

#### Eliminar credentials en texto claro almacenadas en LSA Secrets (servicio SNMPTRAP)

```powershell
cmd /c 'sc.exe config SNMPTRAP obj= LocalSystem password= ""'

# Reiniciar 
sc.exe stop SNMPTRAP
sc.exe start SNMPTRAP
```

#### Control de origen (LogonWorkstations)

> Restringe la autenticación al endpoint only desde `HOST_NAME`, bloqueando access remotos desde sistemas no autorizados

```powershell
# restringir que mspdb solo pueda loguearse desde MSP-SQLREPORT
Set-ADUser mspdb -LogonWorkstations "MSP-SQLREPORT"

# verificar
Get-ADUser mspdb -Properties LogonWorkstations | select Name,LogonWorkstations

# Eliminar restricción
Set-ADUser mspdb -LogonWorkstations $null
```

- `Set-ADUser`: cmdlet para modificar propiedades de un user en Active Directory
- `-Identity user`: especifica la account target
- `-LogonWorkstations "HOST_NAME"`: limita desde qué hosts puede autenticarse la account

> allows login only desde `MSP-SQLREPORT`, bloquea autenticación desde otros hosts (ej. `IT-SQLSRV02`)
## 3. CREDENTIAL HYGIENE

### Controles de acceso estrictos

```powershell
# Romper herencia del directorio copiando los permissions actuales como explícitos
# (allows modificar/eliminar ACEs sin que vuelvan a heredarse del padre)
icacls D:\files /inheritance:d

# Eliminar principals amplios para reducir superficie de acceso
icacls D:\files /remove "Everyone"
icacls D:\files /remove "Authenticated Users"
icacls D:\files /remove:g Users
```

- `g` = permissions permitidos

#### TrustedHosts

```powershell
# Limpieza
winrm set winrm/config/client '@{TrustedHosts=""}'

# Verificacion 
winrm get winrm/config/client | findstr TrustedHosts
```

### Gestión y Rotación Segura de Credenciales (LAPS, Usuarios y Equipos)

#### Rotación de credentials de users

> La primera rotación invalida credentials conocidas; la segunda asegura la invalidez de cualquier material derivado previamente (tickets o claves Kerberos).

```powershell
# AD Module - Rotación 1
Set-ADAccountPassword -Identity user -Reset -NewPassword (ConvertTo-SecureString "REDACTED_SECRET" -AsPlainText -Force)

# AD Module - Rotación 2
Set-ADAccountPassword -Identity user -Reset -NewPassword (ConvertTo-SecureString "REDACTED_SECRET" -AsPlainText -Force)
```

#### Rotación de credentials de hosts

> El reseteo de la account de máquina invalida cualquier material de autenticación previamente compromised (TGT, hashes o claves), restableciendo la trust relationship segura con el domain y evitando la reuse del acceso desde el host compromised.

```powershell
Reset-ComputerMachinePassword -Server host.domain.example
```

#### Rotación de credentials LAPS

1. Identifica hosts que tienen configurado LAPS (atributo presente en AD)

```powershell
Get-ADComputer -LDAPFilter "(ms-Mcs-AdmPwdExpirationTime=*)" -Properties ms-Mcs-AdmPwdExpirationTime | select Name,@{n="Expiration";e={[datetime]::FromFileTime($_."ms-Mcs-AdmPwdExpirationTime")}},@{n="PropertyNames";e={$_.PropertyNames -join ", "}} | fl
```

2. Remediation

> Se establece el atributo `ms-Mcs-AdmPwdExpirationTime : 0` → marca la againstseña como expirada. El host generará una nueva password en el siguiente procesamiento de GPO

```powershell
#  Por host:
Set-ADComputer "HOST" -Replace @{"ms-Mcs-AdmPwdExpirationTime"=0}

# Para todos los hosts:
Get-ADComputer -Filter * -Properties ms-Mcs-AdmPwdExpirationTime | ? { $_."ms-Mcs-AdmPwdExpirationTime" -ne 0 } | % { Set-ADComputer $_.DistinguishedName -Replace @{"ms-Mcs-AdmPwdExpirationTime"=0} }
```

- `Set-ADComputer ... -Replace @{"ms-Mcs-AdmPwdExpirationTime"=0}`: Marca la againstseña LAPS como expirada en Active Directory, forzando su regeneración en el siguiente procesamiento de políticas por parte del host

3. Ejecución 

> Fuerza al host a procesar inmediatamente las políticas de grupo, esto activa el cliente LAPS y provoca la rotación de la againstseña

```powershell
# Local
Invoke-Command -ComputerName HOST -ScriptBlock { gpupdate /force }

# Remoto
Import-Module .\GroupPolicy
Invoke-GPUpdate -Computer HOST -Force
```

- `gpupdate /force`: Obliga al host a aplicar inmediatamente las GPO, activando el cliente LAPS y desencadenando la rotación de la againstseña
- `Invoke-GPUpdate`: Permite forzar remotamente la actualización de políticas en el host target, facilitando la rotación sin necesidad de acceso interactivo directo

4. Verificación

> Consulta directa del estado actual de LAPS (password + expiración)

```powershell
# Por host:
Get-LAPSPasswords -Computer HOST

# Global:
Get-LAPSPasswords | Sort-Object Hostname,Expiration -Descending | Sort-Object Hostname -Unique | select Hostname,Expiration,Password
```

#### Implementar Windows LAPS. Esto genera passwords únicas para administradores locales en cada host

```powershell
# Instalar Windows LAPS:
Install-WindowsFeature LAPS

# Configurar almacenamiento en AD:
Update-LapsADSchema

# Configurar via GPO:
Computer Configuration
 └ Administrative Templates
   └ System
     └ LAPS
```
### Hardening de Credenciales y Protección de Identidades en Windows (Tier 0 Ready)

This conjunto de controles refuerza la protección de credentials en memoria, autenticación y exposición operativa, reduciendo significativamente la attack surface frente a técnicas como credential dumping, Pass-the-Hash y abuso de sesiones administrativas.

> Requiere reinicio del sistema (`shutdown /r /t 0`) para que los cambios se apliquen completamente y entren en efecto.

#### Habilitar protección de LSASS (RunAsPPL).

> RunAsPPL mitiga el acceso a LSASS en memoria, impidiendo que herramientas como Mimikatz o técnicas de volcado (e.g., `comsvcs MiniDump`) extraigan credentials directamente del proceso. Sin embargo, no ofrece protección sobre volcados de memoria ya generados, los cuales pueden ser exfiltrados y analizados offline por un atacante sin restricciones.

```powershell
# Habilitar (RunAsPPL)
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Lsa" /v RunAsPPL /t REG_DWORD /d 1 /f

# Verificación  
reg query "HKLM\SYSTEM\CurrentControlSet\Control\Lsa" /v RunAsPPL
# RunAsPPL    REG_DWORD    0x1

# (Opcional) Credential Guard
bcdedit /set hypervisorlaunchtype auto
```

#### Deshabilitar almacenamiento de credentials cacheadas (MSCache)

```powershell
# Deshabilitar credentials cacheadas:
reg add "HKLM\Software\Microsoft\Windows NT\CurrentVersion\Winlogon" /v CachedLogonsCount /t REG_SZ /d 0 /f

# Verificar configuración actual:
reg query "HKLM\Software\Microsoft\Windows NT\CurrentVersion\Winlogon" /v CachedLogonsCount
#  CachedLogonsCount    REG_SZ    0
```

> MSCache en 0 → puede afectar laptops/offline logon (pero en environment server/lab OK)

#### Deshabilitar almacenamiento de credentials en texto claro

```powershell
# Evitar WDigest (credentials en claro en memoria)
reg add HKLM\SYSTEM\CurrentControlSet\Control\SecurityProviders\WDigest /v UseLogonCredential /t REG_DWORD /d 0 /f

# Verificacion
reg query HKLM\SYSTEM\CurrentControlSet\Control\SecurityProviders\WDigest /v UseLogonCredential
```

#### Restringir acceso a hives (SAM / SYSTEM / SECURITY)

> El volcado de hives del registro permanece como un vector viable para atacantes con privileges administrativos

```powershell
# Restaurar permissions por defecto (SYSTEM + Administrators)
icacls C:\Windows\System32\config\SAM /inheritance:e
icacls C:\Windows\System32\config\SAM /grant:r "SYSTEM:F" "Administrators:F"

icacls C:\Windows\System32\config\SYSTEM /inheritance:e
icacls C:\Windows\System32\config\SYSTEM /grant:r "SYSTEM:F" "Administrators:F"

icacls C:\Windows\System32\config\SECURITY /inheritance:e
icacls C:\Windows\System32\config\SECURITY /grant:r "SYSTEM:F" "Administrators:F"

# Verificacion
icacls.exe "C:\Windows\System32\config\SAM"
# NT AUTHORITY\SYSTEM:(F)
# BUILTIN\Administrators:(F)
```

#### Protección de Credenciales via Credential Guard (VBS)

> Credential Guard utiliza Virtualization-Based Security (VBS) para aislar los secrets de autenticación del resto del sistema operativo, protegiéndolos incluso frente a atacantes con privileges administrativos. Esta protección only es aplicable en sistemas que soportan virtualización (VBS), ya que depende de mecanismos de aislamiento a nivel de hardware. En environments donde no exists soporte de virtualización, this medida no puede implementarse ni ofrecer protección efectiva.

```powershell
# 1. Verificar si el host SOPORTA VBS (virtualización)
systeminfo | findstr /i "Virtualization"

# Alternativa más completa (si exists la clase)
Get-CimInstance -ClassName Win32_Processor | select Name, VirtualizationFirmwareEnabled, SecondLevelAddressTranslationExtensions
# Name                                   VirtualizationFirmwareEnabled SecondLevelAddressTranslationExtensions
# ----                                   ----------------------------- ---------------------------------------
# Intel(R) Xeon(R) D-2141I CPU @ 2.20GHz                         False                                   False

# 2. Verificar si Device Guard / VBS is disponible
Get-CimInstance -ClassName Win32_DeviceGuard -ErrorAction SilentlyContinue

# 3. Verificar configuración (registry)
reg query HKLM\SYSTEM\CurrentControlSet\Control\DeviceGuard
reg query HKLM\SYSTEM\CurrentControlSet\Control\DeviceGuard\Scenarios\CredentialGuard
```

#### Limitar qué hosts pueden usar CredSSP

```powershell
# Verificar
Get-WSManCredSSP
# The machine is not configured to allow delegating fresh credentials = OK ✔️

# 1. Deshabilitar CredSSP como cliente
Disable-WSManCredSSP -Role Client

# 2. Deshabilitar CredSSP como servidor
Disable-WSManCredSSP -Role Server

# Revisar GPO:
Computer Configuration
 └ Administrative Templates
   └ System
     └ Credentials Delegation
```

En GPO buscar y cambiarlo a `disabled`

- Allow delegating fresh credentials
- Allow delegating fresh credentials with NTLM-only server authentication

> Evitar `*` (wildcards)

#### Activar Tamper Protection

```powershell
Windows Security → Virus & threat protection → Manage settings → Tamper Protection → ON
```

#### Protección del Historial de PowerShell (PSReadLine)

> El módulo PSReadLine gestiona el historial de comandos en PowerShell. Deshabilitar su almacenamiento evita que comandos ejecutados (potencialmente sensibles) queden registrados en disco, reduciendo la exposición de credentials o técnicas utilizadas. Esta medida only aplica si PSReadLine is disponible en el sistema. En environments donde no exists (como algunas sesiones remotas o versiones old), no es necesario aplicarla

```powershell
# 1. Verificar si PSReadLine is disponible
Get-Module -ListAvailable PSReadLine
# ModuleType Version    Name         ExportedCommands
# ---------- -------    ----         ----------------
# Script     2.2.6      PSReadLine   {Get-PSReadLineOption, Set-PSReadLineOption, ...}

# 2. (Opcional) Importar módulo si exists
Import-Module PSReadLine -ErrorAction SilentlyContinue

# 3. Deshabilitar almacenamiento de historial
Set-PSReadLineOption -HistorySaveStyle SaveNothing

# 4. Verificar configuración
Get-PSReadLineOption | select HistorySaveStyle
Get-PSReadLineOption | select HistorySavePath
```

- Si `PSReadLine` no is presente → no hay historial persistente que deshabilitar
- Si is presente → this configuración evita que comandos se guarden en disco


### Implementar políticas de passwords robustas

```powershell
net accounts /minpwlen:15 /lockoutthreshold:5 /lockoutduration:15 /lockoutwindow:15

# verificar
net accounts

# Force user logoff how long after time expires?:       Never
# Minimum password age (days):                          1
# Maximum password age (days):                          42
# Minimum password length:                              15
# Length of password history maintained:                24
# Lockout threshold:                                    5
# Lockout duration (minutes):                           15
# Lockout observation window (minutes):                 15
# Computer role:                                        SERVER
```


## 4. DELEGATION & TRUST

#### Eliminar delegaciones

`-server domain.example`  si estamos en dominos distintos 

```powershell
# RBCD
Set-ADComputer -Identity "HOST_NAME" -Clear msDS-AllowedToActOnBehalfOfOtherIdentity

# Verificación
Get-ADComputer -Identity "HOST_NAME" -Properties msDS-AllowedToActOnBehalfOfOtherIdentity | select Name,msDS-AllowedToActOnBehalfOfOtherIdentity

# CONSTRAINED DELEGATION (KCD)
Set-ADComputer -Identity "HOST_NAME" -Clear msDS-AllowedToDelegateTo

# PROTOCOL TRANSITION (S4U)
Set-ADAccountControl -Identity "HOST_NAME$" -TrustedToAuthForDelegation $false

# Verificación: accounts/hosts con Protocol Transition enabled
Get-ADObject -LDAPFilter "(&(userAccountControl:1.2.840.113556.1.4.803:=16777216)(|(objectClass=user)(objectClass=computer)))" -Properties samaccountname,useraccountcontrol | select samaccountname,useraccountcontrol

# UNCONSTRAINED DELEGATION
Set-ADComputer -Identity "HOST_NAME" -TrustedForDelegation $false

# Eliminar Unconstrained Delegation en todos los hosts del domain
Get-ADComputer -Filter {TrustedForDelegation -eq $true} | Set-ADComputer -TrustedForDelegation $false

# Verificación
Get-DomainObject -LDAPFilter "(&(objectCategory=computer)(userAccountControl:1.2.840.113556.1.4.803:=524288))" -Properties samaccountname,useraccountcontrol | select samaccountname,useraccountcontrol
```

- `msDS-AllowedToActOnBehalfOfOtherIdentity` → define qué identidades pueden actuar en nombre de users sobre el recurso (RBCD).
- `msDS-AllowedToDelegateTo` → define a qué servicios puede delegar una account/host (KCD).
- `TrustedToAuthForDelegation` → habilita Protocol Transition (S4U), allowing solicitar tickets en nombre de users sin requerir sus credentials.
- `TrustedForDelegation` → habilita Unconstrained Delegation, exponiendo TGTs reenviables en el sistema delegado.

> Los tickets observados tras la mitigation de `Unconstrained Delegation` corresponden a artifacts previamente almacenados en memoria

Cuando la delegation sea estrictamente necesaria, debe priorizarse Kerberos Constrained Delegation (KCD) frente a Unconstrained Delegation, limitando explícitamente los servicios autorizados.

```powershell
Set-ADComputer -Identity "HOST_NAME" -Add @{msDS-AllowedToDelegateTo="HTTP/server.domain.example"}
```

#### Proteger accounts sensibles frente a delegation (Account is sensitive and cannot be delegated)

> Qué sana: evita que tickets Kerberos de accounts privilegiadas puedan ser reenviados o reutilizados en escenarios de delegation  
> Bloquea: abuso de delegation (Unconstrained / Constrained), robo de TGTs, ataques como Pass-the-Ticket o Delegation abuse

```powershell
# Marcar accounts críticas como no delegables
Set-ADAccountControl -Identity "Administrator" -AccountNotDelegated $true

# Domain Admins
Get-ADGroupMember "Domain Admins" | % { Set-ADAccountControl -Identity $_.SamAccountName -AccountNotDelegated $true }

# Enterprise Admins
Get-ADGroupMember "Enterprise Admins" | % { Set-ADAccountControl -Identity $_.SamAccountName -AccountNotDelegated $true }

# Administrators
Get-ADGroupMember "Administrators" | % { Set-ADAccountControl -Identity $_.SamAccountName -AccountNotDelegated $true }

# Domain Controller → evita que su TGT sea reenviado a sistemas con delegación (mitiga abuso de Unconstrained Delegation)
Set-ADAccountControl -Identity "DC01$" -AccountNotDelegated $true
```

Además, se recomienda incluir accounts administrativas en Protected Users para endurecer aún más su uso en Kerberos y reducir exposición de credentials.

#### Habilitar SID Filtering en trusts

This cambio debe aplicarse sobre la trust relationship entre domains distintos. No es valid utilizar el mismo domain como origen y destino, ya que el SID Filtering only aplica en escenarios inter-domain.

```powershell
# Habilitar SID Filtering en la trust (evita aceptación de SIDs externos)
netdom trust domain.example /domain:remote.example /quarantine:yes

# Deshabilitar el uso de SIDHistory en la trust (evita escaladas vía SIDHistory)
netdom trust internal.msp.example /domain:msp.example /EnableSIDHistory:no
```

> La habilitación de SID Filtering fuerza al domain de destino a ignorar SIDs que no pertenecen a su propio espacio de seguridad, impidiendo la inyección de privileges via SIDHistory desde domains confiables.

#### Restringir la creación de accounts de máquina

Reducir `MachineAccountQuota` evita que users autenticados creen nuevos hosts en el domain, limitando vectores comunes de abuso como RBCD o ataques basados en accounts de máquina controladas por el atacante.

```powershell
Set-ADDomain -Identity it.gcb.example -Replace @{"ms-DS-MachineAccountQuota"="0"}
```

> Esta medida reduce la superficie para abusos como RBCD, pero no elimina configuraciones de delegation maliciosas ya existentes ni accounts de máquina creadas previamente.

#### Habilitar LDAP Signing

> Exigir firmado LDAP ayuda a mitigar abusos y relay sobre LDAP en controladores de domain.

```powershell
Set-ItemProperty HKLM:\SYSTEM\CurrentControlSet\Services\NTDS\Parameters -LDAPServerIntegrity 2
```

## 5. REMOTE ACCESS JEA & PSWA (WINRM)

### Reasignación de acceso a PSWA a accounts autorizadas (principio de mínimo privilegio)

> Revocar el acceso a PSWA para accounts no autorizadas (por ejemplo, accounts operativas o de servicio) y restringirlo only a identidades administrativas controladas. Esto reduce la attack surface y evita el abuso de acceso remoto via navegador

```powershell
# Verificar
Get-PswaAuthorizationRule
# Id    RuleName         User         Destination  ConfigurationName
# --    --------         ----         -----------  -----------------
# 0     Rule 0           msp\mspdb    *            *

# Eliminar acceso PSWA de la account no autorizada
Get-PswaAuthorizationRule | where {$_.User -eq "msp\mspdb"} | Remove-PswaAuthorizationRule
Remove-PswaAuthorizationRule -Id 0

# Asignar acceso únicamente a account administrativa autorizada
Add-PswaAuthorizationRule -UserName "DOMAIN\ADMIN_USER" -ComputerName "HOST_NAME" -ConfigurationName "Microsoft.PowerShell"

Add-PswaAuthorizationRule -UserName "msp\mspdb" -ComputerName "MSP-SRV01" -ConfigurationName "Microsoft.PowerShell"
```

### WINRM

```powershell
# Ver endpoints con permissions asignados
Get-PSSessionConfiguration | Select Name, Permission

# ================================
# CAPA 1 - CONTROL GLOBAL (WinRM / RootSDDL)
# ================================

# Obtener configuración del servicio WinRM
winrm get winrm/config/service
(Get-Item WSMan:\localhost\Service\RootSDDL).Value

# RootSDDL controla quién puede iniciar session WinRM ANTES de llegar al endpoint
# Ejemplo:
# RootSDDL = "O:NSG:BAD:P(A;;GA;;;BA)(A;;GR;;;IU)S:P(AU;FA;GA;;;WD)(AU;SA;GXGW;;;WD)"

# ================================
# 4. ENDURECIMIENTO ROOTSDDL
# ================================

# Restringir acceso global a WinRM (solo Administrators + opcional Remote Management Users)
Set-Item WSMan:\localhost\Service\RootSDDL -Value "O:NSG:BAD:P(A;;GA;;;BA)(A;;GR;;;IU)(A;;GX;;;RM)S:(AU;FA;GA;;;WD)(AU;SA;GXGW;;;WD)"

# Recomendación:
# Mantener RootSDDL lo más restrictivo posible (idealmente solo Administrators)

# ================================
# CAPA 2 - CONTROL POR ENDPOINT
# ================================

# Ver SDDL del endpoint específico
Get-PSSessionConfiguration -Name Microsoft.PowerShell  | Select Name, SecurityDescriptorSddl

# Ver permissions en formato ACL (más claro) 
(Get-PSSessionConfiguration -Name Microsoft.PowerShell).Permission
```

> Modificar la CAPA 1 (RootSDDL) de WinRM puede resultar peligroso, ya que amplía el acceso global al servicio allowing que cualquier miembro del grupo `Remote Management Users` establezca sesiones remotas, incrementando la attack surface en caso de compromiso de credentials; en lugar de esto, es preferible mantener el RootSDDL lo más restrictivo posible (idealmente only administradores) y delegar el acceso via JEA (Just Enough Administration) a nivel de endpoint, donde se puede aplicar control granular y principio de mínimo privilegio sin exponer innecesariamente el servicio WinRM.
### JEA

1. ELIMINAR EL ENDPOINT COMPROMETIDO

```powershell
Unregister-PSSessionConfiguration -Name JEA_NAME -Force
```

- El endpoint ya no es confiable tras haber sido modificado
- Puede contener permissions persistentes ocultos (SDDL alterado)
- Puede estar vinculado a una configuración `.pssc` manipulada
- Puede permitir acceso a users no autorizados

> Eliminarlo garantiza partir de un estado limpio y sin backdoors

2. RESTRINGIR ACCESO AL ENDPOINT (CONTROL DE ACCESO)

```powershell
# Limitar el endpoint a Administrators únicamente
Set-PSSessionConfiguration -Name JEA_NAME -SecurityDescriptorSddl "O:NSG:BAD:P(A;;GA;;;BA)" -Force

# Confrimación
Get-PSSessionConfiguration -Name JEA_Name | Select Name, SecurityDescriptorSddl
```

- Define quién puede conectarse al endpoint
- Limita el acceso only a Administrators (BA)
- Previene que users estándar o compromised puedan autenticarse

> El SDDL es la primera línea de defensa del endpoint. Si esto falla → todo lo demás cae

3. IMPLEMENTAR ENDPOINT SEGURO CON JEA

```powershell
# Registrar endpoint JEA usando account virtual (no credentials reales)
Register-PSSessionConfiguration -Name JEA_NAME -RunAsVirtualAccount -Force
```

- Crea un endpoint con aislamiento de privileges
- Usa una account virtual temporal, evitando exponer credentials reales
- Permite ejecutar tareas controladas sin dar acceso total al sistema

> Reduce el impacto de compromiso. Evita reuse de credentials privilegiadas

#### Creación de un JEA

```powershell
# Eliminar el endpoint JEA vulnerable antes de desplegar una nueva configuración segura
Unregister-PSSessionConfiguration -Name JEA_NAME -Force
```

```powershell
# Crea carpeta de transcripts (auditoría) y asegura permissions 
mkdir C:\ProgramData\JEAConfiguration\Transcripts -Force
icacls C:\ProgramData\JEAConfiguration\Transcripts /inheritance:r
icacls C:\ProgramData\JEAConfiguration\Transcripts /grant "SYSTEM:(OI)(CI)(F)" "Administrators:(OI)(CI)(F)"

# Crea estructura de módulo para RoleCapabilities  
mkdir C:\JEA
mkdir "C:\Program Files\WindowsPowerShell\Modules\JEARoles\RoleCapabilities" -Force

@{ ModuleVersion='1.0' } | Out-File "C:\Program Files\WindowsPowerShell\Modules\JEARoles\JEARoles.psd1" -Encoding utf8 -Force

# Genera 2 GUID distintos:  
# → uno para el .pssc (session config)  
# → otro para el .psrc (role capability) 
([guid]::NewGuid()).Guid

# Frag4
copy .\ProcessReader.pssc C:\JEA\
copy .\ProcessReader.psrc "C:\Program Files\WindowsPowerShell\Modules\JEARoles\RoleCapabilities\"
```

- El `GUID` deben ser diferentes porque identifican objetos distintos dentro de JEA
- `.psrc` → debe estar dentro de `Modules\<ModuleName>\RoleCapabilities\` para que JEA lo cargue correctamente`
- `.pssc` → puede estar en cualquier ruta (`C:\JEA`)


#### CREACIÓN DEL ROLE CAPABILITY (.psrc)

```powershell
notepad "C:\Program Files\WindowsPowerShell\Modules\JEARoles\RoleCapabilities\ProcessReader.psrc"
```

```powershell
@{
GUID = '...'
Author = 'AUTHOR'
Description = 'Read-only process visibility'

ModulesToImport = 'Microsoft.PowerShell.Core'

VisibleCmdlets = @{
    Name = 'Get-Process'
    Parameters = @(
        @{ Name = 'Name' },
        @{ Name = 'Id' }
    )
}
}
```

#### CREACIÓN DE LA SESSION CONFIG (.pssc)

```powershell
notepad C:\JEA\ProcessReader.pssc
```

```powershell
@{
SchemaVersion = '10.200.13.0'
GUID = '...'
Author = 'AUTHOR'

SessionType = 'RestrictedRemoteServer'
TranscriptDirectory = 'C:\ProgramData\JEAConfiguration\Transcripts'
RunAsVirtualAccount = $true

RoleDefinitions = @{
    'DOMAIN\user' = @{
        'RoleCapabilities' = 'ProcessReader'
    }
}

LanguageMode = 'NoLanguage'
}
```

>  Solo entra: `DOMAIN\user`

#### VALIDACIÓN DE ARCHIVOS

```powershell
ls "C:\Program Files\WindowsPowerShell\Modules\JEARoles\RoleCapabilities"
# 297 ProcessReader.psrc

ls "C:\JEA"
# 382 ProcessReader.pssc

ls "C:\Program Files\WindowsPowerShell\Modules\JEARoles"
# RoleCapabilities
# 417 JEARoles.psd1
```

#### REGISTRO DEL ENDPOINT

```powershell
# NTOM
Invoke-Command -ComputerName IP -Credential $cred -ScriptBlock {Register-PSSessionConfiguration -Name ProcessReader -Path C:\JEA\ProcessReader.pssc -Force}

# KERBEROS
Invoke-Command -ComputerName FQDN -ScriptBlock {Register-PSSessionConfiguration -Name ProcessReader -Path C:\JEA\ProcessReader.pssc -Force}
```

#### troubleshooting por si se muere el JEA cuando se hace el Set-PSSessionConfiguration

> Ejecutar directamente en el host (vía SMB con herramientas como `psexec` o via acceso RDP)

```powershell
# Restaura la configuración por defecto de WinRM (useful si hubo cambios previos o inconsistencias)
winrm invoke Restore winrm/Config

# Habilita PowerShell Remoting y crea listeners necesarios (abre puertos, configura servicio y firewall)
Enable-PSRemoting -Force

# Reinicia el servicio WinRM para aplicar cambios
Restart-Service WinRM

# Elimina el endpoint JEA previo (evita conflictos al re-registrar)
Unregister-PSSessionConfiguration -Name ProcessReader -Force

# Lista listeners activos (HTTP/HTTPS)
winrm enumerate winrm/config/listener

# Verifica que WinRM responde correctamente en el host remoto
Test-WsMan IP
```

#### USO DEL ENDPOINT

```powershell
Enter-PSSession -ComputerName IP -ConfigurationName ProcessReader -Credential (Get-Credential domain\user)
```

> Solo allows `Get-Process`

## 6. HOST HARDENING

#### Revisión y eliminación de privileges excesivos en GPO (Restricted Groups)

```powershell
notepad.exe "\\it.gcb.example\SysVol\it.gcb.example\Policies\{54578190-EE80-4CE2-9B46-893247F3B4FA}\Machine\Microsoft\Windows NT\SecEdit\GptTmpl.inf"
```

```powershell
[Unicode]
Unicode=yes
[Version]
signature="$CHICAGO$"
Revision=1
[Privilege Rights]
SeDenyNetworkLogonRight =
SeDenyBatchLogonRight =
SeDenyServiceLogonRight =
SeDenyInteractiveLogonRight =
SeDenyRemoteInteractiveLogonRight =
[Group Membership]
# *S-1-5-21-948911695-1962824894-4291460450-1121__Memberof = *S-1-5-32-544
# *S-1-5-21-948911695-1962824894-4291460450-1121__Members =
[Registry Values]
MACHINE\System\CurrentControlSet\Services\Netlogon\Parameters\DisablePasswordChange=4,0
```

En este punto se elimina la relación que añadía el grupo `Services` al grupo local `Administrators`, evitando así la asignación automática de privileges administrativos.

> La aplicación de this medida depende del diseño operativo del environment. Si no es necesario que el user `ldapintegration` disponga de privileges administrativos locales en el host `IT-PREPROD`, this modification allows reducir la attack surface eliminando una escalada de privileges indirecta a través de GPO.

Aplicación de la política en el host afectado

```powershell
gpupdate /force
```

This comando debe ejecutarse en el host `IT-PREPROD` para forzar la aplicación inmediata de los cambios realizados en la GPO

> En caso de que el user `ldapintegration` requiera acceso al host `IT-PREPROD` por motivos operativos, se recomienda implementar un modelo basado en JEA (Just Enough Administration), allowing acceso remoto controlado y limitado sin necesidad de otorgar privileges administrativos completos

#### Crear GPO + aplicar restricciones de logon

```powershell
# =========================================
# 1. Crear nueva GPO
# =========================================
New-GPO -Name "Hardening - Logon Restrictions"


# =========================================
# 2. Linkear GPO (ejemplo al domain)
# ⚠️ Ajusta el DN a tu environment
# =========================================
New-GPLink -Name "Hardening - Logon Restrictions" -Target "DC=domain,DC=local"

# =========================================
# 3. Configurar restricciones (User Rights)
# =========================================
# ⚠️ Estas settings realmente se aplican mejor vía GPMC GUI
# Pero puedes usar plantilla de seguridad (secedit)

# Crear plantilla
@"
[Unicode]
Unicode=yes
[Version]
signature=`"$CHICAGO$`"
Revision=1

[Privilege Rights]
SeDenyInteractiveLogonRight = user
SeDenyRemoteInteractiveLogonRight = user
SeDenyNetworkLogonRight = user
SeDenyServiceLogonRight = user
SeDenyBatchLogonRight = user
"@ | Out-File C:\temp\deny_logon.inf -Encoding ascii


# =========================================
# 4. Importar a la GPO
# =========================================
Import-GPO -BackupGpoName "Hardening - Logon Restrictions" -Path C:\temp -TargetName "Hardening - Logon Restrictions"
```

#### Applocker

```powershell
# Crear política AppLocker por defecto (permitir solo rutas estándar seguras)
New-AppLockerPolicy -DefaultRule -XMLPolicy C:\temp\applocker.xml

# Aplicar la política AppLocker
Set-AppLockerPolicy -XMLPolicy C:\temp\applocker.xml -Merge

# Crear política más restrictiva (solo binarios firmados / confiables)
New-AppLockerPolicy -RuleType Publisher,Path -User Everyone -XMLPolicy C:\temp\applocker.xml

# Aplicar política estricta
Set-AppLockerPolicy -XMLPolicy C:\temp\applocker.xml

# Forzar ejecución de scripts firmados en PowerShell
Set-ExecutionPolicy AllSigned -Scope LocalMachine -Force
```

#### Deshabilitar Print Spooler en servidores críticos (DC)

> Se recomienda deshabilitar este servicio en controladores de domain y servidores críticos.

```powershell
# Deshabilitar
Stop-Service Spooler -Force; Set-Service Spooler -StartupType Disabled

# Ver estado del servicio
Get-Service Spooler

# Ver tipo de inicio
Get-Service Spooler | Select Name, Status, StartType
# Name     Status StartType
# ----     ------ ---------
# Spooler Stopped  Disabled
```

La desactivación del servicio Print Spooler reduce la attack surface frente a técnicas de coerción de autenticación, evitando que sistemas críticos inicien conexiones autenticadas towards hosts potencialmente compromised, no hacerlo en hosts que realmente necesiten imprimir

#### Implementar segmentación y evitar acceso SMB administrativo innecesario (C$)

> Va de la mano con `SeDenyNetworkLogonRight` → identidad

```powershell
# Ejemplo: bloquear SMB (445)
New-NetFirewallRule -DisplayName "Block SMB" -Direction Inbound -Protocol TCP -LocalPort 445 -Action Block
```

#### PowerShell Logging (Transcription + Script Block Logging)

Para detectar abuso de JEA o ejecución de herramientas ofensivas, se recomienda habilitar PowerShell logging avanzado. Habilitar PowerShell Transcription:

```powershell
Set-ItemProperty HKLM:\SOFTWARE\Policies\Microsoft\Windows\PowerShell\Transcription -Name EnableTranscripting -Value 1

# Habilitar Script Block Logging:
Set-ItemProperty HKLMsetspn:\SOFTWARE\Policies\Microsoft\Windows\PowerShell\ScriptBlockLogging -Name EnableScriptBlockLogging -Value 1
```

#### Revisión de SPNs asociados

```powershell
# Valida que la account no tenga SPNs innecesarios o mal configurados.
setspn -L sqlsvc
```

#### Forzar uso de HTTPS (eliminar HTTP)

```powershell
Import-Module WebAdministration; Set-WebConfigurationProperty -Filter /system.webServer/security/access -Name sslFlags -Value "Ssl"; New-WebBinding -Name "Default Web Site" -Protocol https -Port 443
```

#### Restricción de acceso a sensitive files (control de permissions ACL)

```powershell
icacls "C:\Bitnami\redmine-*\apps\redmine\htdocs\attachments" /inheritance:r; icacls "C:\Bitnami\redmine-*\apps\redmine\htdocs\attachments" /grant "SYSTEM:F"
```
## 7. INFRASTRUCTURE (WSUS / HYPER-V)

#### Restricción de tráfico saliente en clientes WSUS, ejecutar desde el cliente (ej. vault-srv)
  
```powershell
# Bloquear todo el tráfico saliente por defecto (modo restrictivo)
Set-NetFirewallProfile -Profile Domain,Private,Public -DefaultOutboundAction Block

# Permitir solo tráfico towards WSUS (HTTP/HTTPS)
New-NetFirewallRule -DisplayName "Allow WSUS HTTP" -Direction Outbound -RemoteAddress gcb-wsus.gcb.example -Protocol TCP -RemotePort 8530 -Action Allow
New-NetFirewallRule -DisplayName "Allow WSUS HTTPS" -Direction Outbound -RemoteAddress gcb-wsus.gcb.example -Protocol TCP -RemotePort 8531 -Action Allow

# (Opcional) Permitir DNS para resolución de nombres
New-NetFirewallRule -DisplayName "Allow DNS" -Direction Outbound -Protocol UDP -RemotePort 53 -Action Allow

# Result:
# Solo puede salir tráfico towards WSUS y servicios necesarios → bloquea reverse shells a hosts arbitrarios
```

#### Habilitar uso obligatorio de HTTPS para WSUS

```powershell
# Ver configuración IIS:
Get-WebBinding

# Forzar uso de HTTPS:
Set-ItemProperty "HKLM:\Software\Policies\Microsoft\Windows\WindowsUpdate" -Name WUServer -Value "https://wsus.domain.example:8531"

# Reiniciar IIS:
iisreset
```

#### Restricción de acceso interactivo al servidor WSUS (implementación de Tiering)

```powershell
# Restringir quién puede iniciar session en el servidor WSUS (evitar Tier 2)
secedit /export /cfg C:\temp\secpol.cfg; (gc C:\temp\secpol.cfg) -replace 'SeInteractiveLogonRight = .*','SeInteractiveLogonRight = DOMAIN\Admins' | sc C:\temp\secpol.cfg; secedit /configure /db secedit.sdb /cfg C:\temp\secpol.cfg /areas USER_RIGHTS
```

```powershell
# Denegar login a users no privilegiados (más fuerte):
secedit /export /cfg C:\temp\secpol.cfg; (gc C:\temp\secpol.cfg) -replace 'SeDenyInteractiveLogonRight = .*','SeDenyInteractiveLogonRight = DOMAIN\Users' | sc C:\temp\secpol.cfg; secedit /configure /db secedit.sdb /cfg C:\temp\secpol.cfg /areas USER_RIGHTS
```

- Solo admins (Tier 0/1) pueden loguearse
- Bloqueas users normales (Tier 2) en ese servidor

#### Asegurar infraestructura WSUS ~ Protege cadena de actualización

> Qué sana: garantiza que only actualizaciones legítimas y firmadas sean distribuidas a los clientes  
> Bloquea: inyección de updates maliciosos, ejecución remota de código vía WSUS, bypass de segmentación de red

```powershell
Set-WSUSServerSynchronization -SyncFromMicrosoftUpdate $true
```

#### Restringir acceso administrativo a WSUS ~ Protege superficie de administración

> Qué sana: limita quién puede crear, modificar o aprobar actualizaciones en WSUS  
> Bloquea: abuso de herramientas como `WSUSpendu`, inyección de payloads y ejecución remota en clientes

```powershell
net localgroup "WSUS Administrators" /delete USER
```

#### Forzar uso de HTTPS en WSUS ~ Protege integridad del tráfico

> Qué sana: cifra la comunicación entre clientes y WSUS evitando manipulación de tráfico  
> Bloquea: MITM, descarga de payloads maliciosos disfrazados de updates

```powershell
Set-ItemProperty -Path "HKLM:\Software\Policies\Microsoft\Windows\WindowsUpdate" -Name WUServer -Value "https://wsus.domain.example"
```

#### Restringir ejecución de binarios no firmados (AppLocker / WDAC) ~ Protege ejecución de código

> Qué sana: prevents que binarios como `PsExec` o scripts descargados se ejecuten  
> Bloquea: payload execution vía WSUS, living-off-the-land abuse

```powershell
New-AppLockerPolicy -DefaultRule -XMLPolicy C:\Windows\Temp\policy.xml
```

- Monitorizar actividad de WSUS ~ Protege `detección temprana`

> Qué sana: allows identificar creación/approval de updates sospechosos  
> Bloquea: persistencia silenciosa via updates maliciosos

```powershell
Get-WinEvent -LogName "Microsoft-Windows-WindowsUpdateServer/Operational"
```

#### Segmentar acceso desde WSUS a clientes ~ Protege movimiento lateral

> Qué sana: limita qué sistemas pueden comunicarse con WSUS  
> Bloquea: pivoting towards segmentos isolateds (ej: `vault-srv`)

```powershell
New-NetFirewallRule -DisplayName "Restrict WSUS Clients" -Direction Inbound -Action Allow -RemoteAddress TRUSTED_SUBNET
```

#### Configurar firma obligatoria de actualizaciones. Solo updates firmadas por Microsoft o por certificados autorizados deben ejecutarse.

```powershell
# Verificar configuración WSUS:
Get-WsusServer | Select-Object Name,PortNumber

# Configurar aprobación manual estricta:
Set-WsusServerSynchronization -SyncFromMU
```

#### Eliminar actualizaciones maliciosas

```powershell
# Enumerar actualizaciones aprobadas en WSUS
# → Permite identificar updates distribuidas a clientes (incluyendo la maliciosa)
Get-WsusUpdate -Approval Approved

# Limpiar la inyección maliciosa del update específico
# → Elimina el payload insertado (NO elimina la update del WSUS)
.\Wsuspendu.ps1 -Clean -UpdateID 7b76663d-10b8-4b09-899f-4850f74a20a4

# Limpiar todo de golpe
Get-WsusUpdate | Where-Object {$_.Title -like "*KB2862335*"} | ForEach-Object {.\wsus.ps1 -Clean -UpdateID $_.Id.UpdateId}
```

#### Cifrado de discos en host y máquina virtual (protección against extracción offline de NTDS.dit)

```powershell
Enable-BitLocker -MountPoint "D:" -EncryptionMethod XtsAes256 -UsedSpaceOnly
```

> Protege los `.vhdx` desde fuera

```powershell
# Dentro de la VM (host)
Enable-BitLocker -MountPoint "C:" -EncryptionMethod XtsAes256 -UsedSpaceOnly

# Permitir BitLocker sin TPM
gpedit.msc
# Computer Config → Administrative Templates → BitLocker → OS Drives
# "Require additional authentication at startup" → ENABLE → Allow without TPM
```

- Although alguien haga:
    - `Mount-VHD`
    - robe el `.vhdx`
    - intente leer `NTDS.dit`

> NO podrá leer nada (todo cifrado)

#### Implementar Shielded VMs (Hyper-V)

Microsoft recomienda utilizar Shielded Virtual Machines para proteger controladores de domain virtualizados. Esto evita que un administrador del hypervisor pueda montar discos y leer su contenido.

```powershell
# Verificar estado actual de la VM
Get-VM vault-dc | Select Name,Shielded

# Habilitar Secure Boot (requisito para Shielded VM)
Set-VMFirmware -VMName vault-dc -EnableSecureBoot On

# Crear Key Protector (modo lab sin HGS)
$kp = New-HgsKeyProtector -Owner "Contoso" -AllowUntrustedRoot

# Asignar Key Protector a la VM
Set-VMKeyProtector -VMName vault-dc -KeyProtector $kp.RawData

# Habilitar Shielded VM
Set-VM -VMName vault-dc -Shielded $true

# Verificar que la VM is protegida
Get-VM vault-dc | Select Name,Shielded
```

- Bloquea acceso al disco (`.vhdx`)
- ❌ Impide `Mount-VHD`
- ❌ Evita acceso desde el host
- ❌ Bloquea PowerShell Direct
- ✔️ Restringe significativamente el acceso del host al contenido de la VM y endurece su ejecución sobre hosts autorizados

#### Proteger el acceso a discos virtuales. Los discos VHDX que contienen controladores de domain deben tener permissions restringidos.

```powershell
# Verificar permissions:
Get-Acl "C:\Users\Public\Documents\Hyper-V\Virtual hard disks"

# Restringir acceso únicamente a administradores autorizados:
icacls "C:\Users\Public\Documents\Hyper-V\Virtual hard disks" /inheritance:r
icacls "C:\Users\Public\Documents\Hyper-V\Virtual hard disks" /grant "SYSTEM:(F)" "Administrators:(F)"
```

#### Restricción de acceso interactivo al host (control de uso de PowerShell Direct)

```powershell
# Restringir quién puede iniciar session en el host (evita abuso)
secedit /export /cfg C:\temp\secpol.cfg; (gc C:\temp\secpol.cfg) -replace 'SeInteractiveLogonRight = .*','SeInteractiveLogonRight = DOMAIN\Admins' | sc C:\temp\secpol.cfg; secedit /configure /db secedit.sdb /cfg C:\temp\secpol.cfg /areas USER_RIGHTS

# (Opcional fuerte) Denegar login a users normales
secedit /export /cfg C:\temp\secpol.cfg; (gc C:\temp\secpol.cfg) -replace 'SeDenyInteractiveLogonRight = .*','SeDenyInteractiveLogonRight = DOMAIN\Users' | sc C:\temp\secpol.cfg; secedit /configure /db secedit.sdb /cfg C:\temp\secpol.cfg /areas USER_RIGHTS
```

## 8. CLEANUP (POST-COMPROMISE)

#### Invalidación de sesiones — WINRM / SMB / HOST

Si es remoto juega con `Invoke-Command -ComputerName HOST -ScriptBlock {} -ErrorAction SilentlyContinue`

```powershell
# Cerrar sesiones WinRM (PowerShell Remoting)
# Intenta finalizar sesiones remotas activas desde el contexto de PowerShell
Get-PSSession | Remove-PSSession

# Matar procesos asociados a WinRM (más agresivo). Termina procesos wsmprovhost responsables de sesiones WinRM activas
Get-Process wsmprovhost | Stop-Process -Force -ErrorAction SilentlyContinue

# Cerrar sesiones SMB
net session
net session /delete

# Eliminar tickets Kerberos en el host actual  
# Invalida tickets en memoria (TGT/TGS), forzando reautenticación   (No elimina sesiones ya establecidas ni procesos en ejecución)
klist purge  
  
# Enumerar y cerrar sesiones activas de user en el sistema  
query session  
logoff <ID>  
  
# Reiniciar servicio Kerberos (Domain Controller) → Impacto limitado en sesiones ya activas  
Restart-Service KDC

# Reinicio del sistema (Elimina completamente sesiones, tokens y procesos en memoria)
shutdown /r /t 0
```

> Reiniciar el servicio KDC afecta only al Domain Controller donde se ejecuta, provocando una interrupción temporal en la emisión de tickets Kerberos, pero no genera apagones ni reinicios en otros hosts del domain.

#### Eliminación de artifacts en el host compromised

```powershell
# Restaurar Defender (por si quedó desenabled)
Set-MpPreference -DisableRealtimeMonitoring $false

# Eliminar port forwarding
netsh interface portproxy show all
netsh interface portproxy delete v4tov4 listenport=443 listenaddress=0.0.0.0

# Eliminar artefactos sensibles (.dmp, hives, cred dumps)
Remove-Item *.dmp,*.hiv,*.kirbi -Force -ErrorAction SilentlyContinue

# Limpiar archivos típicos de dumping
Remove-Item C:\Windows\Temp\*.dmp,C:\Windows\Temp\*.hiv -Force -ErrorAction SilentlyContinue

# Limpiar posibles herramientas usadas
Remove-Item C:\Windows\Temp\mimikatz*,C:\Windows\Temp\rubeus*,C:\Windows\Temp\procdump* -Force -ErrorAction SilentlyContinue

# Limpiar historial PowerShell
Remove-Item (Get-PSReadlineOption).HistorySavePath -Force -ErrorAction SilentlyContinue
```

#### Eliminar Hosts

```powershell
Remove-ADComputer -Identity "HOST_NAME" -Confirm:$false
```

#### Eliminar secrets operativos o de negocio almacenados en texto claro

> Además de credentials, deben eliminarse códigos, claves de transferencia, secrets operativos o cualquier dato sensible almacenado en escritorios, shares o archivos de user.

- Revisar Desktop, Documents y rutas compartidas de users privilegiados
- Eliminar archivos con secrets expuestos
- Rotar o invalidar los valuees compromised si forman parte de un proceso de negocio
## 9. LOGGING & DETECTION

#### Concepto Clave

```
auditpol → define qué eventos se generan
Get-WinEvent → consulta los eventos generados
```

> Se recomienda el análisis de eventos via campos estructurados (`EventData.Properties`) en lugar de parsing de texto (`Message`), garantizando mayor precisión y resiliencia ante cambios de formato o localización.

#### Regla de interpretación

Un único evento rara vez confirma un abuso por sí only. La detection debe apoyarse en la correlación temporal y lógica entre autenticación, ejecución, modification de objetos, acceso posterior a recursos sensibles y contexto operativo del sistema afectado.

#### QUICK TRIAGE (visión rápida global)

> Overview rápido de actividad sospechosa. Puede utilizarse `Message` como vista inicial; para validación y análisis consistente, priorizar siempre `EventData.Properties`.

```powershell
Get-WinEvent -LogName Security | ? { $_.Id -in 4624,4625,4672,4688,4662,4728,4732,4769 } | select TimeCreated,Id,Message -First 50
```

- auth
- exec
- priv
- AD
### AUDIT CONFIGURATION (Generación de eventos)

> Si no activas `auditpol` → no hay logs que analizar

```powershell
# =========================
# 1. AUTHENTICATION & ACCOUNT USAGE
# =========================

# Logon (4624, 4625)
auditpol /set /subcategory:"Logon" /success:enable /failure:enable

# Privileged logon (4672)
auditpol /set /subcategory:"Special Logon" /success:enable

# Explicit credentials (4648)
auditpol /set /subcategory:"Credential Validation" /success:enable /failure:enable


# =========================
# 2. LATERAL MOVEMENT / REMOTE EXECUTION
# =========================

# File Share (5140, 5145 - SMB lateral movement)
auditpol /set /subcategory:"File Share" /success:enable


# =========================
# 3. CREDENTIAL ACCESS
# =========================

# File System (.dmp, .vhdx - dumps, exfil)
auditpol /set /subcategory:"File System" /success:enable /failure:enable

# Registry (SAM, SYSTEM, SECURITY)
auditpol /set /subcategory:"Registry" /success:enable /failure:enable

# Privilege Use (4673 - SeDebug → LSASS)
auditpol /set /subcategory:"Sensitive Privilege Use" /success:enable


# =========================
# 4. PRIVILEGE ESCALATION & PERSISTENCE
# =========================

# Group changes (4728, 4732)
auditpol /set /subcategory:"Security Group Management" /success:enable


# =========================
# 5. AD / LDAP ABUSE
# =========================

# DCSync / atributos sensibles / objetos AD críticos (4662)
auditpol /set /subcategory:"Directory Service Access" /success:enable

# Cambios en AD (5136)
auditpol /set /subcategory:"Directory Service Changes" /success:enable


# =========================
# 6. EXECUTION / TRACKING (GLOBAL)
# =========================

# Process Creation (4688)
auditpol /set /subcategory:"Process Creation" /success:enable

# CommandLine logging (CRÍTICO)
reg add HKLM\Software\Microsoft\Windows\CurrentVersion\Policies\System\Audit /v ProcessCreationIncludeCmdLine_Enabled /t REG_DWORD /d 1 /f


# =========================
# 7. INFRASTRUCTURE / ADVANCED
# =========================

# Kernel Object (evasión avanzada)
auditpol /set /subcategory:"Kernel Object" /success:enable


# =========================
# VERIFICACIÓN
# =========================

auditpol /get /category:*
```

### EVENTOS CLAVES

| Evento             | Categoría                       | Uso real                          | Qué detecta                                                                                        |
| ------------------ | ------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------- |
| 4624               | Auth                            | Logon exitoso                     | Acceso, lateral movement (Type 3/10), PtH (Type 9)                                                 |
| 4625               | Auth                            | Logon fallido                     | Brute force / password spraying                                                                    |
| 4648               | Auth                            | Credenciales explícitas           | `runas`, `cmdkey`, `winrs`                                                                         |
| 4672               | Auth / Priv                     | Privilegios especiales            | Inicio de session privilegiado                                                                      |
| 4688               | Execution                       | Creación de procesos              | Ejecución (Mimikatz, WinRM, LOLBins)                                                               |
| 4768               | Kerberos                        | TGT request                       | Uso de accounts críticas (`krbtgt`, DCs)                                                            |
| 4769               | Kerberos                        | TGS request                       | Lateral movement, S4U, delegation, RBCD                                                            |
| 4662               | AD                              | Acceso a objetos AD               | DCSync, read de atributos sensibles, acceso a objetos críticos del directorio                   |
| 5136               | AD                              | Cambios en AD                     | Modificación de atributos/objetos sensibles (delegation, PAM, membresías, ACLs, Shadow Principals) |
| 4728               | PrivEsc                         | Grupo domain                     | Escalada a groups privilegiados                                                                    |
| 4732               | PrivEsc                         | Grupo local                       | Escalada a Administrators                                                                          |
| 4656 / 4663        | CredAccess                      | Acceso a objetos                  | SAM, SYSTEM, SECURITY, dumps, `.vhdx`                                                              |
| 4673               | CredAccess                      | Privilegios sensibles             | `SeDebugPrivilege` (LSASS access)                                                                  |
| 5140 / 5145        | Lateral                         | Acceso a shares                   | Movimiento lateral (`C$`)                                                                          |
| 5007               | Evasion                         | Cambios Defender                  | Desactivación de protecciones                                                                      |
| Sysmon 10          | CredAccess                      | Acceso a proceso                  | Acceso directo a LSASS (CRÍTICO)                                                                   |
| WinRM Operational  | Lateral / Administración remota | Cambios en remoting y endpoints   | JEA, endpoints, configuración WinRM                                                                |
| Hyper-V Logs       | Infra                           | Operaciones VM                    | Stop/Start de VM, abuso de VHDX, PowerShell Direct                                                 |
| Hyper-V PowerShell | Infra / Administración          | Enumeration y manipulación de VMs | abuso de host Hyper-V, acceso a discos, operaciones sobre VMs críticas                             |

#### CAMPOS CLAVE MAS USADOS

```
4624
→ User        = Properties[5]
→ Domain      = Properties[6]
→ LogonType   = Properties[8]
→ Workstation = Properties[11]
→ SourceIP    = Properties[18]

4625
→ User        = Properties[5]
→ SourceIP    = Properties[19]

4648
→ User        = Properties[1]
→ Target      = Properties[5]
→ Process     = Properties[9]
→ SourceIP    = Properties[11]

4672
→ User        = Properties[1]
→ Privileges  = Properties[2]

4688
→ User        = Properties[1]
→ Process     = Properties[5]
→ CommandLine = Properties[8]

4728 / 4732
→ AddedMember = Properties[0]
→ Group       = Properties[2]
→ Actor       = Properties[6]

4768
→ User        = Properties[0]
→ SourceIP    = Properties[8]

4769
→ User        = Properties[0]
→ Service     = Properties[2]
→ Target      = Properties[3]
→ Options     = Properties[7]
→ SourceIP    = Properties[8]

4662
→ User        = Properties[1]
→ Object      = Properties[6]
→ GUID        = Properties[8]

5136
→ User        = Properties[1]
→ Object      = Properties[8]
→ Operation   = Properties[9]
→ Attribute   = Properties[10]
```

## 10. CORRELACIÓN POR TÉCNICA

### 1. Authentication & Account Usage

- Evento main: `4624`  
- Eventos complementarios: `4625`, `4648`, `4672`, `4768`  
- Indicador: uso anómalo de credentials, logon privilegiado, autenticación remota  
- Riesgo: lateral movement, uso indebido de accounts, abuso de credentials

> Detecta quién se autentica, cómo y desde dónde

```powershell
$user="USER_TO_MONITOR"; $groups="GROUP1|GROUP2"; $hosts="HOST"

# 1. 4624 – uso de la account (quién, desde dónde y cómo se autentica)
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4624} | % { [PSCustomObject]@{User=$_.Properties[5].Value;LogonType=$_.Properties[8].Value;Workstation=$_.Properties[11].Value;IP=$_.Properties[18].Value} } | ? { $_.User -match $user }

# 2. 4624 – autenticaciones remotas (lateral movement: network / RDP)
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4624} | % { [PSCustomObject]@{User=$_.Properties[5].Value;Type=$_.Properties[8].Value;IP=$_.Properties[18].Value} } | ? { $_.Type -in 3,10 -and $_.User -match $user }

# 3. 4624 – posible Pass-the-Hash / NewCredentials (tipo 9 + admin)
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4624} | % { [PSCustomObject]@{User=$_.Properties[5].Value;Type=$_.Properties[8].Value;IP=$_.Properties[18].Value} } | ? { $_.Type -eq 9 -or ($_.Type -eq 3 -and $_.User -match "admin") }

# 4. 4672 – asignación de privileges elevados (inicio de session privilegiado)
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4672} | % { [PSCustomObject]@{User=$_.Properties[1].Value;Privileges=$_.Properties[2].Value} } | ? { $_.User -match $user }

# 5. 4625 – intentos fallidos (brute force / password spraying)
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4625} | % { [PSCustomObject]@{User=$_.Properties[5].Value;IP=$_.Properties[19].Value} } | ? { $_.User -match $user }

# 6. 4648 – uso de credentials explícitas (runas / cmdkey / winrs)
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4648} | % { [PSCustomObject]@{User=$_.Properties[1].Value;Target=$_.Properties[5].Value;Process=$_.Properties[9].Value;IP=$_.Properties[11].Value} }

# 7. 4768 – TGT anómalo (accounts críticas como krbtgt o DCs)
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4768} | % { [PSCustomObject]@{User=$_.Properties[0].Value;IP=$_.Properties[8].Value} } | ? { $_.User -match "krbtgt|DC" }
```

### 2. Lateral Movement / Remote Execution

- Evento main: `4624`, `4688`, `4769`  
- Eventos complementarios: WinRM Operational, `5140`, `5145`  
- Indicador: acceso remoto, ejecución remota, uso de servicios para pivot lateral  
- Riesgo: expansión a nuevos hosts, acceso a endpoints críticos, abuso de remoting

> Detecta ejecución remota y lateral movement

```powershell
# 1. 4688 – ejecución remota vía WinRM / PowerShell (wsmprovhost = WinRM host process)
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4688} | % { [PSCustomObject]@{Process=$_.Properties[5].Value;User=$_.Properties[1].Value;CommandLine=$_.Properties[8].Value} } | ? { $_.Process -match "wsmprovhost" -or $_.CommandLine -match "Enter-PSSession|Invoke-Command" }

# 2. 4769 – uso sospechoso de tickets Kerberos (S4U / delegación towards servicios críticos)
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4769} | % { [PSCustomObject]@{User=$_.Properties[0].Value;Service=$_.Properties[2].Value;Target=$_.Properties[3].Value;Options=$_.Properties[7].Value} } | ? { $_.Service -match "ldap|cifs|http" }

# 3. WinRM Operational – cambios en configuración remota (JEA / endpoints personalizados)
Get-WinEvent -LogName "Microsoft-Windows-WinRM/Operational" | % { [PSCustomObject]@{Id=$_.Id;Message=$_.Message} } | ? { $_.Message -match "Set-PSSessionConfiguration|Register-PSSessionConfiguration|Enable-PSRemoting" }

# 4. 4624 – accesos remotos sospechosos (network / RDP → lateral movement)
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4624} | % { [PSCustomObject]@{User=$_.Properties[5].Value;Type=$_.Properties[8].Value;IP=$_.Properties[18].Value} } | ? { $_.Type -in 3,10 }

# 5. 5140 / 5145 – acceso a shares administrativos (C$)
Get-WinEvent -FilterHashtable @{LogName='Security';ID=5140,5145} | % { [PSCustomObject]@{User=$_.Properties[1].Value;Share=$_.Properties[4].Value;IP=$_.Properties[3].Value}} | ? { $_.Share -match "C\$" }
```

### 3. Credential Access

- Evento main: `4688`, `4663`, `4673`  
- Eventos complementarios: `4656`, Sysmon `10`, `5140`, `5145`  
- Indicador: dumping, acceso a hives, acceso a LSASS, acceso a dumps o discos sensibles  
- Riesgo: robo de hashes, passwords, tickets y secrets reutilizables

> Detecta robo de credentials / dumping

```powershell
# 1. 4688 – ejecución de herramientas de dumping (Mimikatz, Rubeus, etc)
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4688} | % { [PSCustomObject]@{User=$_.Properties[1].Value;Process=$_.Properties[5].Value;CommandLine=$_.Properties[8].Value}} | ? { $_.Process -match "mimikatz|lsass|procdump|rubeus" -or $_.CommandLine -match "sekurlsa|logonpasswords" }

# 2. 4688 – dumping offline (sin tocar LSASS directamente)
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4688} | % { [PSCustomObject]@{ User=$_.Properties[1].Value; Process=$_.Properties[5].Value; CommandLine=$_.Properties[8].Value } } | ? { $_.Process -match "reg.exe|esentutl|vssadmin|secretsdump" }

# 3. 4663 – acceso a dumps de memoria (.dmp)
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4663} | % { [PSCustomObject]@{ Object=$_.Properties[6].Value; User=$_.Properties[1].Value } } | ? { $_.Object -match "\.dmp" }

# 4. 4656 / 4663 – acceso a hives sensibles (SAM / SYSTEM / SECURITY)
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4656,4663} | % { [PSCustomObject]@{ User=$_.Properties[1].Value; Object=$_.Properties[6].Value; AccessMask=$_.Properties[9].Value } } | ? { $_.Object -match "SAM|SYSTEM|SECURITY" }

# 5. 4673 – uso de privileges sensibles (SeDebugPrivilege)
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4673} | % { [PSCustomObject]@{ User=$_.Properties[1].Value; Service=$_.Properties[0].Value } } | ? { $_.Service -match "SeDebugPrivilege" }

# 6. Sysmon Event ID 10 – acceso directo a LSASS (CRÍTICO)
Get-WinEvent -LogName "Microsoft-Windows-Sysmon/Operational" | % { [PSCustomObject]@{ Source=$_.Properties[0].Value; Target=$_.Properties[4].Value; GrantedAccess=$_.Properties[9].Value } } | ? { $_.Target -match "lsass.exe" }

# 7. 4663 – acceso a discos virtuales (.vhdx)
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4663} | % { [PSCustomObject]@{ User=$_.Properties[1].Value; Object=$_.Properties[6].Value } } | ? { $_.Object -match "\.vhdx" }
```

### 4. Privilege Escalation & Persistence

Evento main: `4728`, `4732`, `5136`  
Eventos complementarios: `4624`, `4672`  
Indicador: cambios de membresía, acceso privilegiado nuevo, escalada sobre host o domain  
Riesgo: persistencia, admin local, admin de domain, abuso de roles críticos

> Detecta cambios de privileges

```powershell
# 1. 4728 – user añadido a grupo privilegiado de domain (Domain Admins, etc)
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4728} | % { [PSCustomObject]@{Added=$_.Properties[0].Value;Group=$_.Properties[2].Value;Actor=$_.Properties[6].Value} } | ? { $_.Added -match $user -or $_.Group -match $groups }

# 2. 4732 – user añadido a grupo local (posible escalada en host)
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4732} | % { [PSCustomObject]@{Added=$_.Properties[0].Value;Group=$_.Properties[2].Value;Actor=$_.Properties[6].Value} } | ? { $_.Added -match $user -or $_.Group -match $groups }

# 3. 4732 – escalada directa a Administrators (impacto inmediato en host)
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4732} | % { [PSCustomObject]@{Group=$_.Properties[2].Value;Added=$_.Properties[0].Value;Actor=$_.Properties[6].Value} } | ? { $_.Group -match "Administrators" -and $_.Added -match $user }
```

- Movimiento típico → añadirte a `Administrators`

### 5. AD / LDAP Abuse (CRITICAL)

- Evento main: `4662`, `5136`, `4769`  
- Eventos complementarios: `4624`, `4672`  
- Indicador: DCSync, modification de objetos sensibles, PAM abuse, trust abuse, delegation  
- Riesgo: compromiso de domain, cross-domain pivot, cross-forest escalation

```powershell
# 1. 4662 – DCSync / replicación de secretos (GUIDs críticos de replicación)
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4662} | % { [PSCustomObject]@{User=$_.Properties[1].Value;Object=$_.Properties[6].Value;GUID=$_.Properties[8].Value} } | ? { $_.GUID -match "1131f6aa|1131f6ad|89e95b76" }

# 2. 5136 – modificación de objetos sensibles (Shadow Principals / PAM abuse)
Get-WinEvent -FilterHashtable @{LogName='Security';ID=5136} | % { [PSCustomObject]@{User=$_.Properties[1].Value;Object=$_.Properties[8].Value;Attribute=$_.Properties[10].Value;Operation=$_.Properties[9].Value} } | ? { $_.Object -match "Shadow Principal Configuration" -or $_.Attribute -match "msDS-ShadowPrincipal" }

# 3. 4624 – autenticación cross-domain/forest sospechosa (lateral entre domains)
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4624} | % { [PSCustomObject]@{User=$_.Properties[5].Value;Domain=$_.Properties[6].Value;Type=$_.Properties[8].Value} } | ? { $_.Type -eq 3 -and $_.Domain -notmatch "gcbacc" }

# 4. 4672 – privileges elevados en accounts externas (indicador de trust abuse)
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4672} | % { [PSCustomObject]@{User=$_.Properties[1].Value;Privileges=$_.Properties[2].Value} } | ? { $_.User -match "gcbsec" }

# 5. 4769 – uso de tickets Kerberos desde domain externo (movimiento lateral inter-forest)
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4769} | % { [PSCustomObject]@{User=$_.Properties[0].Value;Service=$_.Properties[2].Value;Target=$_.Properties[3].Value} } | ? { $_.User -match "gcbsec" }

# 6. 4769 – accounts máquina usando tickets (delegación / RBCD / abuso Kerberos)
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4769} | % { [PSCustomObject]@{User=$_.Properties[0].Value;Service=$_.Properties[2].Value;IP=$_.Properties[8].Value} } | ? { $_.User -match "\$" }
```

- `1131f6aa` → Replicating Directory Changes
- `1131f6ad` → Replicating Directory Changes All
- `89e95b76` → Replicating Directory Changes In Filtered Set


### 6. Infrastructure Abuse

- Evento main: WSUS / WinRM / Hyper-V / host logs  
- Eventos complementarios: `4688`, `4663`, `4624`  
- Indicador: abuso de infraestructura administrativa para ejecución, pivot o extracción offline  
- Riesgo: bypass de segmentación, compromiso masivo, acceso a VMs críticas, control indirecto del domain

```powershell
# 1. WSUS – creación reciente de updates (posible payload malicioso)
$time=(Get-Date).AddDays(-1); Get-WsusUpdate | % { [PSCustomObject]@{Title=$_.Title;Date=$_.CreationDate} } | ? { $_.Date -gt $time }

# 2. WSUS – updates aprobados recientemente (ejecución potencial en endpoints)
$time=(Get-Date).AddDays(-1); Get-WsusUpdate -Approval Approved | % { [PSCustomObject]@{Title=$_.Title;Date=$_.CreationDate} } | ? { $_.Date -gt $time }

# 3. WSUS – aprobaciones masivas (impacto masivo vía "All Computers")
Get-WsusUpdate -Approval Approved | % { $_.GetUpdateApprovals() } | % { [PSCustomObject]@{Update=$_.UpdateTitle;Target=$_.ComputerTargetGroupName} } | ? { $_.Target -match "All Computers" }

# 4. 4688 – ejecución sospechosa en servidor WSUS
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4688} | % { [PSCustomObject]@{Process=$_.Properties[5].Value;CommandLine=$_.Properties[8].Value} } | ? { $_.CommandLine -match "powershell|psexec|bitsadmin|certutil|http" }

# 5. Hyper-V logs
Get-WinEvent -LogName "Microsoft-Windows-Hyper-V-Worker/Admin"

# 6. 4663 – acceso a discos virtuales (.vhdx)
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4663} | % { [PSCustomObject]@{ User=$_.Properties[1].Value; Object=$_.Properties[6].Value } } | ? { $_.Object -match "\.vhdx" }

# 7. Hyper-V / PowerShell – manipulación de VMs o discos
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4688} | % { [PSCustomObject]@{Process=$_.Properties[5].Value;CommandLine=$_.Properties[8].Value} } | ? { $_.CommandLine -match "Get-VM|Stop-VM|Start-VM|Mount-VHD|New-PSSession -VMName" }
```

### 7. Defense Evasion

- Evento main: `5007`  
- Eventos complementarios: `4688`, cambios de configuración  
- Indicador: desactivación o alteración de controles de seguridad  
- Riesgo: reducción de visibilidad, facilitación de dumping, ejecución de tooling ofensivo

> No toda la visibilidad proviene de `auditpol`; algunos componentes críticos como Defender generan telemetry independiente

```powershell
# 1. 5007 – cambios en Windows Defender
Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Windows Defender/Operational';ID=5007} | % { [PSCustomObject]@{Time=$_.TimeCreated;Message=$_.Message} } | ? { $_.Message -match "DisableRealtimeMonitoring" }
```
