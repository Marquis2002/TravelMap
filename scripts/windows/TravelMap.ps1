param(
    [ValidateSet('Start', 'Stop')]
    [string]$Action = 'Start',
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$runtimeRoot = Join-Path $projectRoot '.local-runtime'
$statePath = Join-Path $runtimeRoot 'services.json'
$services = @(
    @{ Name = 'website'; Folder = 'travel-map'; Port = 5173 },
    @{ Name = 'editor'; Folder = 'travel-map-editor'; Port = 5174 }
)

<#
.SYNOPSIS
Returns only a recorded process whose executable and creation time still match.
.PARAMETER Entry
Saved identity of one Node process launched by this project.
#>
function Get-OwnedProcess($Entry) {
    $running = Get-Process -Id $Entry.Id -ErrorAction SilentlyContinue
    if ($null -eq $running) { return $null }
    if ($running.Path -ne $Entry.Executable -or
        $running.StartTime.ToUniversalTime().Ticks.ToString() -ne $Entry.StartTicks) {
        return $null
    }
    return $running
}

<#
.SYNOPSIS
Stops only still-matching recorded processes and removes their local state file.
.PARAMETER Entries
Process identities loaded from this project's state file.
#>
function Stop-OwnedServices($Entries) {
    foreach ($entry in $Entries) {
        $running = Get-OwnedProcess $entry
        if ($null -ne $running) {
            Stop-Process -InputObject $running
            $null = $running.WaitForExit(10000)
        }
    }
    if (Test-Path -LiteralPath $statePath) {
        Remove-Item -LiteralPath $statePath
    }
}

<#
.SYNOPSIS
Checks that a local service has completed HTTP startup.
.PARAMETER Port
Local service port to check without a system proxy.
#>
function Test-ServiceReady([int]$Port) {
    try {
        $request = [Net.HttpWebRequest]::Create("http://127.0.0.1:$Port/")
        $request.Proxy = $null
        $request.Timeout = 2000
        $response = $request.GetResponse()
        $ready = [int]$response.StatusCode -eq 200
        $response.Close()
        return $ready
    } catch [Net.WebException] {
        return $false
    }
}

<#
.SYNOPSIS
Shows local URLs and active physical-network IPv4 URLs for a phone.
#>
function Show-Addresses {
    Write-Host ''
    Write-Host 'Website: http://localhost:5173'
    Write-Host 'Editor (this computer only): http://localhost:5174'
    foreach ($adapter in [Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
        if ($adapter.OperationalStatus -ne 'Up' -or
            $adapter.NetworkInterfaceType -eq 'Loopback') { continue }
        $properties = $adapter.GetIPProperties()
        if ($properties.GatewayAddresses.Count -eq 0) { continue }
        foreach ($address in $properties.UnicastAddresses) {
            if ($address.Address.AddressFamily -eq 'InterNetwork') {
                Write-Host "Phone (same Wi-Fi): http://$($address.Address):5173"
            }
        }
    }
    Write-Host "Logs: $runtimeRoot"
    Write-Host 'Use Stop-TravelMap.cmd to stop. Closing this window keeps the site running.'
}

$null = New-Item -ItemType Directory -Path $runtimeRoot -Force
$operationLock = $null
try {
    $operationLock = [IO.File]::Open(
        (Join-Path $runtimeRoot 'operation.lock'),
        [IO.FileMode]::OpenOrCreate,
        [IO.FileAccess]::ReadWrite,
        [IO.FileShare]::None
    )
    $entries = @()
    if (Test-Path -LiteralPath $statePath) {
        $entries = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
        $entries = @($entries)
    }
    if ($Action -eq 'Stop') {
        Stop-OwnedServices $entries
        Write-Host 'TravelMap stopped. Your photos and travel data are retained.'
        exit 0
    }

    $owned = @($entries | Where-Object { $null -ne (Get-OwnedProcess $_) })
    if ($owned.Count -eq 2 -and
        (Test-ServiceReady 5173) -and (Test-ServiceReady 5174)) {
        Write-Host 'TravelMap is already running.'
        Show-Addresses
        if (-not $NoBrowser) { Start-Process 'http://localhost:5173' }
        exit 0
    }
    Stop-OwnedServices $entries

    $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
    $listeners = [Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    foreach ($service in $services) {
        if (@($listeners | Where-Object Port -eq $service.Port).Count -gt 0) {
            throw "Port $($service.Port) is occupied. Close its application and retry; no unrelated process was stopped."
        }
        $vitePath = Join-Path $projectRoot "apps\$($service.Folder)\node_modules\vite\bin\vite.js"
        if (-not (Test-Path -LiteralPath $vitePath)) {
            throw 'Dependencies are missing. See docs/LOCAL-WINDOWS.md.'
        }
    }

    $started = @()
    try {
        foreach ($service in $services) {
            $appRoot = Join-Path $projectRoot "apps\$($service.Folder)"
            $vitePath = Join-Path $appRoot 'node_modules\vite\bin\vite.js'
            $running = Start-Process -FilePath $nodePath -ArgumentList ('"' + $vitePath + '" --mode local-dev') `
                -WorkingDirectory $appRoot -WindowStyle Hidden -PassThru `
                -RedirectStandardOutput (Join-Path $runtimeRoot "$($service.Name).out.log") `
                -RedirectStandardError (Join-Path $runtimeRoot "$($service.Name).err.log")
            $started += [pscustomobject]@{
                Name = $service.Name
                Id = $running.Id
                Executable = $nodePath
                StartTicks = $running.StartTime.ToUniversalTime().Ticks.ToString()
            }
            ConvertTo-Json -InputObject @($started) | Set-Content -LiteralPath $statePath -Encoding UTF8
        }
        $deadline = [DateTime]::UtcNow.AddSeconds(60)
        do {
            foreach ($entry in $started) {
                if ($null -eq (Get-OwnedProcess $entry)) {
                    throw "$($entry.Name) exited. Inspect $runtimeRoot for details."
                }
            }
            $ready = (Test-ServiceReady 5173) -and (Test-ServiceReady 5174)
            if ($ready) { break }
            Start-Sleep -Milliseconds 500
        } while ([DateTime]::UtcNow -lt $deadline)
        if (-not $ready) { throw "Startup timed out. Inspect $runtimeRoot for details." }
    } catch {
        Stop-OwnedServices $started
        throw
    }
    Show-Addresses
    if (-not $NoBrowser) { Start-Process 'http://localhost:5173' }
} catch {
    Write-Host "TravelMap: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    if ($null -ne $operationLock) { $operationLock.Dispose() }
}
