param(
    [Parameter(Mandatory = $true)]
    [string]$Source,
    [switch]$Silent
)

$ErrorActionPreference = 'Stop'
$moduleManifest = Join-Path $Source 'manifest.json'
if (-not (Test-Path -LiteralPath $moduleManifest)) {
    throw "MobiFlight module is incomplete: $moduleManifest was not found."
}

$configFiles = [System.Collections.Generic.List[string]]::new()
$roamingCandidates = @(
    (Join-Path $env:APPDATA 'Microsoft Flight Simulator\UserCfg.opt'),
    (Join-Path $env:APPDATA 'Microsoft Flight Simulator 2024\UserCfg.opt')
)
foreach ($candidate in $roamingCandidates) {
    if (Test-Path -LiteralPath $candidate) { $configFiles.Add($candidate) }
}

$storePackages = Join-Path $env:LOCALAPPDATA 'Packages'
if (Test-Path -LiteralPath $storePackages) {
    Get-ChildItem -LiteralPath $storePackages -Directory -ErrorAction SilentlyContinue |
        ForEach-Object {
            $candidate = Join-Path $_.FullName 'LocalCache\UserCfg.opt'
            if (Test-Path -LiteralPath $candidate) { $configFiles.Add($candidate) }
        }
}

$communityPaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($configFile in $configFiles) {
    foreach ($line in Get-Content -LiteralPath $configFile -ErrorAction SilentlyContinue) {
        if ($line -match '^\s*InstalledPackagesPath\s+"(.+)"\s*$') {
            $packagesPath = [Environment]::ExpandEnvironmentVariables($Matches[1])
            [void]$communityPaths.Add((Join-Path $packagesPath 'Community'))
        }
    }
}

$logDirectory = Join-Path $env:ProgramData 'FenixA320RemoteCockpit'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
$logPath = Join-Path $logDirectory 'mobiflight-module-install.log'

if ($communityPaths.Count -eq 0) {
    $message = 'Microsoft Flight Simulator installation was not found. Start MSFS once, then run "Install or repair MobiFlight module" from the Start menu.'
    Set-Content -LiteralPath $logPath -Value $message
    if (-not $Silent) {
        Add-Type -AssemblyName PresentationFramework
        [System.Windows.MessageBox]::Show($message, 'Fenix A320 Remote Cockpit') | Out-Null
    }
    exit 2
}

$installed = [System.Collections.Generic.List[string]]::new()
foreach ($communityPath in $communityPaths) {
    New-Item -ItemType Directory -Force -Path $communityPath | Out-Null
    $destination = Join-Path $communityPath 'mobiflight-event-module'
    New-Item -ItemType Directory -Force -Path $destination | Out-Null
    Copy-Item -Path (Join-Path $Source '*') -Destination $destination -Recurse -Force
    $installed.Add($destination)
}

$message = "MobiFlight WASM Module installed or updated:`r`n" + ($installed -join "`r`n") + "`r`n`r`nRestart MSFS if it is currently running."
Set-Content -LiteralPath $logPath -Value $message
if (-not $Silent) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show($message, 'Fenix A320 Remote Cockpit') | Out-Null
}

