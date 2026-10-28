$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$runtimeRoot = Join-Path $projectRoot '.local-runtime'
$null = New-Item -ItemType Directory -Path $runtimeRoot -Force
$resultPath = Join-Path $runtimeRoot 'firewall-result.txt'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)

try {
    $ruleName = 'TravelMap-Local-5173'
    $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
    $existing = Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
    if ($null -ne $existing) {
        $port = $existing | Get-NetFirewallPortFilter
        $address = $existing | Get-NetFirewallAddressFilter
        $application = $existing | Get-NetFirewallApplicationFilter
        if ($existing.Direction -ne 'Inbound' -or $existing.Action -ne 'Allow' -or
            $existing.Enabled -ne 'True' -or $port.Protocol -ne 'TCP' -or
            $port.LocalPort -ne '5173' -or
            (@($address.RemoteAddress) -join ',') -ne 'LocalSubnet' -or
            $application.Program -ne $nodePath) {
            throw 'The named firewall rule has unexpected settings. Inspect it before changing it.'
        }
        Write-Host 'The local-subnet-only TravelMap rule is already enabled.'
        exit 0
    }
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        $child = Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -PassThru -Wait `
            -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -File "' + $PSCommandPath + '"')
        if ($child.ExitCode -ne 0) { throw "Firewall setup failed. See $resultPath" }
        Get-Content -LiteralPath $resultPath
        exit 0
    }

    $null = New-NetFirewallRule -Name $ruleName `
        -DisplayName 'TravelMap local website (TCP 5173)' `
        -Direction Inbound -Action Allow -Enabled True -Protocol TCP `
        -LocalPort 5173 -RemoteAddress LocalSubnet -Profile Any -Program $nodePath
    'Enabled TCP 5173 for Node.js from the local subnet only. Editor port 5174 was not opened.' |
        Set-Content -LiteralPath $resultPath -Encoding UTF8
} catch {
    $_.Exception.Message | Set-Content -LiteralPath $resultPath -Encoding UTF8
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
