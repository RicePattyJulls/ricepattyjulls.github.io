## 1. BASELINE (What exists in the environment?)

> Desde `it.gcb.example`, la enumeración de `TrustedDomainObjects` revela tres trust relationships con distintos niveles de exposición y restricciones. Estas relaciones condicionan directamente las posibilidades de lateral movement, enumeración cross-domain y escalada fuera del domain actual.

```powershell
distinguishedname : DC=it,DC=gcb,DC=local
objectsid         : S-1-5-21-948911695-1962824894-4291460450
name              : it
```

```powershell
IT             IT             gcb.example         \\10.200.9.2            IT
GCB            GCB            gcb.example         \\10.200.9.1            GCB
FINANCE        FINANCE        gcbfinance.example  \\10.200.10.1           FINANCE
```

#### Trusts relevant

1. `gcb.example` (Same Forest – Trust implícito)

``` powershell
name                    : gcb.example
trustpartner            : gcb.example
trustdirection          : 3
trustattributes         : 32
trusttype               : 2
flatname                : GCB
```

- Tipo: `Intra-forest` (`trustAttributes = 32 → WITHIN_FOREST`)
- Operational impact: La autenticación entre domains del mismo forest es transparente. Con credentials valid, exists acceso LDAP cross-domain directo y no hay restricciones equivalentes a un trust external con cuarentena.
- Offensive implication: Tras el compromiso de privileges altos en uno de los domains, this relación allows escalar a nivel forest via abuso intra-forest, incluyendo escenarios de `SIDHistory` / `ExtraSIDs`.
- Conclusion: Relación de alto impacto. El compromiso de `it.gcb.example` puede convertirse en compromiso del forest si se alcanza control suficiente sobre el domain

2. `gcbfinance.example` (External Forest – SID Filtering activo)

```powershell
name                    : gcbfinance.example
trustpartner            : gcbfinance.example
trustdirection          : 3
trustattributes         : 516
trusttype               : 2
flatname                : FINANCE
```

- Tipo: `Cross-forest` trust restringido (`trustAttributes = 516` → `CROSS_ORGANIZATION + QUARANTINED_DOMAIN`)
- Impacto: El trust opera en modo `quarantined`, con `SID Filtering` activo, impidiendo la propagación de privileges entre forests y bloqueando el abuso clásico de `SIDHistory`.
- Offensive implication: No representa una vía directa de escalada cross-forest desde privileges altos en `it.gcb.example`. Su explotación dependería de:
	- obtención de credentials valid propias de `gcbfinance.example`
	- weaknesses internas dentro de ese environment
	- pivots indirectos via sistemas o identidades intermedias
- Conclusion: Relación restringida. No es una vía directa de escalada entre forests desde el contexto actual

3. `msp.example` (Inbound Trust – superficie interesante)

```powershell
name                    : msp.example
trustpartner            : msp.example
trustdirection          : 1
trustattributes         : 0
trusttype               : 2
flatname                : MSP
```

- Tipo: `External trust` (`trustDirection = 1` → inbound)
- Impacto: `msp.example` confía en `it.gcb.example`, lo que teóricamente allows autenticación towards recursos en `msp.example` bajo determinadas condiciones.
- Observed limitations: La enumeración directa sobre `msp.example` no fue posible desde el contexto inicial. Posibles causas
	- `Selective Authentication`
	- segmentación de red o firewall (`LDAP`, `SMB`, etc.)
	- restricciones ACL en el domain destino
	- problemas de resolución Kerberos o referrals
	- dependencia del host de origen o del contexto de seguridad efectivo
- Operational hypothesis: Existe al menos una identidad, host o contexto de ejecución valid que sí puede actuar como punto de pivot towards `msp.example`.
- Conclusion: Trust potencialmente explotable, pero completamente dependiente del contexto de ejecución, la identidad disponible y la conectividad efectiva.

#### Structured summary of the domain

| Área            | What matters                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Users           | ~700 users, 703 passwords no expiran, 695 sin cambio >180 días. Muy pocos users activos reales. Cuentas clave: `sqlsvc`, `ldapintegration`, `paadmin`, `trackadmin`, `orgadmin` |
| Groups          | Solo `Administrator` como DA. Grupos clave: `LocalAdmins`, `ITEmployeesMachines`, `ITEmployeesUsers`, `Services`. Muchos groups privilegiados vacíos → environment poco gestionado        |
| Hosts           | 59 servidores, sin workstations. Hosts críticos: `IT-DC` (unconstrained delegation), `IT-SQLSRV02` (posible pivot), `IT-PREPROD` (GPO abuse)                                          |
| Password Policy | Longitud mínima 7, without lockout → password spraying viable. Alta reuse de credentials esperable                                                                               |
| Kerberos        | Sin SPNs ni ASREP → ataque no orientado a Kerberos clásico, foco en credentials y delegation                                                                                         |
| GPOs            | Sin hardening. `PreProd`: `ldapintegration` es admin local → foothold claro. `ITEmployees`: superficie amplia de hosts                                                                |
| Delegation      | Unconstrained delegation en DC → vector crítico de escalada                                                                                                                           |
| Trusts          | Intra-forest explotable (gcb.example), external limitado (gcbfinance), inbound dependiente de contexto (msp.example)                                                                      |
| Infraestructura | Entorno homogéneo (only servers) → cada acceso tiene alto impacto                                                                                                                     |
| Subdomains      | No hay subdomains adicionales → superficie controlada                                                                                                                                |

## 2. IDENTITY (What can I do?)

#### Relevant offensive capabilities identified in the domain

1. `ITEmployeesUsers` → WriteProperty sobre `LocalAdmins` → modification de membresía → potencial escalada de privileges vía grupo
	- Usuario miembro de ese grupo es `itemployee15` (nuestra identidad)
2. `IT\LocalAdmins` tiene permissions de read sobre atributos LAPS (`ms-Mcs-AdmPwd`) en la OU `AppServers` (incluyendo `IT-APPSRV01`), lo que allows recuperar credentials de administrador local en texto claro y facilitar lateral movement towards servidores.
3. `IT\organizationadmins` tiene `WriteDACL` sobre el domain (`DC=it,DC=gcb,DC=local`), allowing delegar permissions de replicación (DCSync) y comprometer completamente el domain.
	- Usuario miembro de ese grupo es `orgadmin`
	- Usuario miembro de ese grupo es `paadmin`
4. El grupo `ITEmployeesMachines` y la máquina `IT-EMPLOYEETEST$` poseen `GenericWrite` sobre `IT-TRACK01`, allowing configurar Resource-Based Constrained Delegation (RBCD) y ejecutar código en dicho host via impersonación Kerberos.
	- Host miembro de ese grupo `IT-EMPLOYEE15$`

#### Technical evidence of relevant ACLs

```powershell
----------------------------------------------------------------------
[+] ACL - Permisos peligrosos sobre grupos privilegiados
----------------------------------------------------------------------
Identity              : IT\ITEmployeesUsers
SecurityIdentifier    : S-1-5-21-948911695-1962824894-4291460450-1124
ActiveDirectoryRights : ReadProperty, WriteProperty, GenericExecute
ObjectAceType         :
ObjectDN              : CN=LocalAdmins,CN=Users,DC=it,DC=gcb,DC=local
ObjectSID             : S-1-5-21-948911695-1962824894-4291460450-1108
IsInherited           : False


----------------------------------------------------------------------
[+] ACL - Quien tiene permisos sobre las OUs (derechos peligrosos)
----------------------------------------------------------------------
Identity              : IT\LocalAdmins
SecurityIdentifier    : S-1-5-21-948911695-1962824894-4291460450-1108
ActiveDirectoryRights : ReadProperty, ExtendedRight
ObjectAceType         : ms-Mcs-AdmPwd
ObjectDN              : OU=AppServers,DC=it,DC=gcb,DC=local
ObjectSID             :
IsInherited           : False

----------------------------------------------------------------------
[+] ACL - Domain Root (delegaciones peligrosas)
----------------------------------------------------------------------
Identity              : IT\organizationadmins
SecurityIdentifier    : S-1-5-21-948911695-1962824894-4291460450-1126
ActiveDirectoryRights : WriteDacl
ObjectAceType         :
ObjectDN              : DC=it,DC=gcb,DC=local
ObjectSID             : S-1-5-21-948911695-1962824894-4291460450
IsInherited           : False

----------------------------------------------------------------------
[+] ACL - Permisos peligrosos sobre Computer Objects
----------------------------------------------------------------------
Identity              : IT\LocalAdmins
SecurityIdentifier    : S-1-5-21-948911695-1962824894-4291460450-1108
ActiveDirectoryRights : ReadProperty, ExtendedRight
ObjectAceType         : ms-Mcs-AdmPwd
ObjectDN              : CN=IT-APPSRV01,OU=AppServers,DC=it,DC=gcb,DC=local
ObjectSID             : S-1-5-21-948911695-1962824894-4291460450-1106
IsInherited           : True

Identity              : IT\IT-EMPLOYEETEST$
SecurityIdentifier    : S-1-5-21-948911695-1962824894-4291460450-1116
ActiveDirectoryRights : ListChildren, ReadProperty, GenericWrite
ObjectAceType         :
ObjectDN              : CN=IT-TRACK01,CN=Computers,DC=it,DC=gcb,DC=local
ObjectSID             : S-1-5-21-948911695-1962824894-4291460450-1107
IsInherited           : False

Identity              : IT\ITEmployeesMachines
SecurityIdentifier    : S-1-5-21-948911695-1962824894-4291460450-1119
ActiveDirectoryRights : ListChildren, ReadProperty, GenericWrite
ObjectAceType         :
ObjectDN              : CN=IT-TRACK01,CN=Computers,DC=it,DC=gcb,DC=local
ObjectSID             : S-1-5-21-948911695-1962824894-4291460450-1107
IsInherited           : False

----------------------------------------------------------------------
[+] LAPS Classic + Windows LAPS - Delegaciones en OU y Computer Objects
----------------------------------------------------------------------
Identity              : IT\LocalAdmins
SecurityIdentifier    : S-1-5-21-948911695-1962824894-4291460450-1108
ActiveDirectoryRights : ReadProperty
ObjectAceType         : ms-Mcs-AdmPwdExpirationTime
ObjectDN              : CN=IT-APPSRV01,OU=AppServers,DC=it,DC=gcb,DC=local
ObjectSID             : S-1-5-21-948911695-1962824894-4291460450-1106
IsInherited           : True

Identity              : IT\LocalAdmins
SecurityIdentifier    : S-1-5-21-948911695-1962824894-4291460450-1108
ActiveDirectoryRights : ReadProperty
ObjectAceType         : ms-Mcs-AdmPwdExpirationTime
ObjectDN              : OU=AppServers,DC=it,DC=gcb,DC=local
ObjectSID             :
IsInherited           : False
```

> Identidad inicial: `itemployee15` + `IT-EMPLOYEE15$`

#### Membresías relevant

```powershell
----------------------------------------------------------------------
[+] GROUP MEMBERSHIP USER
----------------------------------------------------------------------

samaccountname   memberof                                 
--------------   --------                                 
Domain Users     CN=Users,CN=Builtin,DC=it,DC=gcb,DC=local
ITEmployeesUsers                                          

----------------------------------------------------------------------
[+] GROUP MEMBERSHIP HOST
----------------------------------------------------------------------

samaccountname      memberof
--------------      --------
ITEmployeesMachines         
Domain Computers            
```

#### Capacidades derivadas de la identidad inicial

- `itemployee15` pertenece a `ITEmployeesUsers`, grupo con `WriteProperty` sobre `LocalAdmins` → esto allows modificar la membresía de `LocalAdmins` y, en consecuencia, habilitar una ruta towards read de LAPS sobre `AppServers`.
- `IT-EMPLOYEE15$` pertenece a `ITEmployeesMachines`, grupo con `GenericWrite` sobre `IT-TRACK01` → esto allows configurar `RBCD` sobre `IT-TRACK01` y obtener impersonación / ejecución remota en ese host.

#### Evidencia técnica asociada

```powershell
----------------------------------------------------------------------
[+] ACLs explotables relacionadas con mi usuario
----------------------------------------------------------------------
Identity              : IT\ITEmployeesUsers
ActiveDirectoryRights : ReadProperty, WriteProperty, GenericExecute
ObjectAceType         : 
ObjectDN              : CN=LocalAdmins,CN=Users,DC=it,DC=gcb,DC=local
ObjectSID             : S-1-5-21-948911695-1962824894-4291460450-1108
IsInherited           : False

----------------------------------------------------------------------
[+] ACL - Permisos peligrosos sobre grupos privilegiados
----------------------------------------------------------------------
Identity              : IT\ITEmployeesUsers
SecurityIdentifier    : S-1-5-21-948911695-1962824894-4291460450-1124
ActiveDirectoryRights : ReadProperty, WriteProperty, GenericExecute
ObjectAceType         :
ObjectDN              : CN=LocalAdmins,CN=Users,DC=it,DC=gcb,DC=local
IsInherited           : False


----------------------------------------------------------------------
[+] ACLs explotables de hosts anidados
----------------------------------------------------------------------

Identity              : IT\ITEmployeesMachines
ActiveDirectoryRights : ListChildren, ReadProperty, GenericWrite
ObjectAceType         :
ObjectDN              : CN=IT-TRACK01,CN=Computers,DC=it,DC=gcb,DC=local
ObjectSID             : S-1-5-21-948911695-1962824894-4291460450-1107
IsInherited           : False
AceFlags              : None
PropagationFlags      : None
```

#### Conclusion de identidad inicial

La identidad inicial no posee privileges directos altos, pero sí dispone de dos rutas claras de expansión: una basada en modification de membresía de grupo para alcanzar read de `LAPS`, y otra basada en `RBCD` sobre `IT-TRACK01` via la account de máquina. Ambas rutas permiten convertir una identidad de bajo privilegio en acceso operativo sobre hosts con mayor value.

> IDENTIDADES `sqlsvc` + `it-sqlsrv02` (contexto ganado)

En fases posteriores del compromiso se confirmó que el trust con `msp.example` no era universalmente explotable desde cualquier contexto. Las identidades iniciales utilizadas (`itemployee15`, `appmanager`) no permitían enumeración efectiva sobre `msp.example`. Sin embargo, tras obtener acceso administrativo a `IT-SQLSRV02` y ejecutar enumeración desde una session interactiva válida (`RCE`), sí fue posible autenticarse y consultar LDAP en `msp.example`. Esto demuestra que la capacidad de pivot towards domains confiados no depende only de la existencia del trust, sino también de:

- la identidad en uso
- el host de origen
- el contexto de seguridad efectivo de la session

El acceso a `IT-SQLSRV02` no only amplía superficie local dentro de `it.gcb.example`, sino que habilita un contexto de enumeración cross-domain previamente inaccesible, convirtiéndose en un punto de pivot valid towards `msp.example`

#### Conclusion

Desde la identidad inicial (`itemployee15` / `IT-EMPLOYEE15$`) existen rutas reales de abuso apoyadas en ACLs delegadas sobre groups y hosts. La obtención posterior de contextos privilegiados sobre hosts como `IT-SQLSRV02` amplía significativamente el scope operacional, al habilitar enumeración efectiva sobre domains confiados como `msp.example`. En conjunto, la identidad disponible no ofrece control inmediato del domain, pero sí múltiples caminos realistas para alcanzarlo.
## 3. ATTACK PATH (What am I going to do?)

> El target prioritario es obtener credentials de `orgadmin`, miembro de `OrganizationAdmins`, ya que this pertenencia otorga `WriteDACL` sobre el domain y allows derivar control efectivo del mismo via delegation de permissions de replicación (`DCSync`)

#### Attack threads

1. `ITEmployeesUsers` (`itemployee15`) → `WriteProperty` sobre `LocalAdmins` → modification de membresía → read de `LAPS` sobre `AppServers` → acceso a `IT-APPSRV01` como administrador local → lateral movement
2. `ITEmployeesMachines` (`IT-EMPLOYEE15$`) → `GenericWrite` sobre `IT-TRACK01` → abuso de `RBCD` → impersonación Kerberos → ejecución remota en `IT-TRACK01` → ampliación de superficie operativa → `credential hunting` → escalada / pivot a nuevas identidades
3. Acceso a account privilegiada (`orgadmin`) → `organizationadmins` → `WriteDACL` sobre domain → DCSync → compromiso total del domain → abuso de trust `gcb.example` (Extra sids) → escalada intra-forest → compromiso del forest

#### TACTICAL SUPPORT

Acceso inicial

- Password policy débil (`min length = 7`, without lockout, passwords old) → favorece `password spraying`
- Alta probabilidad de reuse de credentials → facilita lateral movement temprano
- Existencia de accounts sensibles (`paadmin`, `trackadmin`, `orgadmin`) → allows targeting directo o password guessing orientado

Expansión y pivot

- GPO `PreProd` → `ldapintegration` como administrador local en `IT-PREPROD` → vector adicional de ejecución remota
- Trust con `msp.example` → pivot condicionado a identidad, host y contexto valids
- Trust con `gcbfinance.example` → descartado como vector directo de escalada; only useful via obtención de credentials propias o pivots indirectos
