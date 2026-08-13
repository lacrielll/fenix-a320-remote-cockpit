$ErrorActionPreference = 'Stop'

$projectDir = $PSScriptRoot
$repoDir = Resolve-Path (Join-Path $projectDir '..\..')
$outputDir = Join-Path $projectDir 'bin\Debug\net8.0'
$webSourceDir = Join-Path $repoDir 'dist'
$webOutputDir = Join-Path $outputDir 'web'
$vsWhere = 'C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe'
$visualStudio = if (Test-Path -LiteralPath $vsWhere) {
    & $vsWhere -latest -products '*' -property installationPath
}
else {
    'C:\Program Files\Microsoft Visual Studio\2022\Community'
}
$compiler = Join-Path $visualStudio 'MSBuild\Current\Bin\Roslyn\csc.exe'
$runtimeRoot = 'C:\Program Files\dotnet\shared\Microsoft.NETCore.App'
$coreRuntime = Get-ChildItem -LiteralPath $runtimeRoot -Directory |
    Where-Object { $_.Name -like '8.*' } |
    Sort-Object { [version]$_.Name } -Descending |
    Select-Object -First 1 -ExpandProperty FullName

if (-not (Test-Path -LiteralPath $compiler)) {
    throw "Roslyn compiler not found: $compiler"
}

foreach ($runtimePath in @($coreRuntime)) {
    if (-not (Test-Path -LiteralPath $runtimePath)) {
        throw "Required .NET runtime not found: $runtimePath"
    }
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

# This Roslyn path produces a framework-dependent managed assembly, not a
# native Windows apphost. Keep the .dll extension so Explorer cannot launch it
# with the legacy CLR and show an unhandled 0xe0434352 application error.
$legacyExe = Join-Path $outputDir 'A320Boards.Bridge.exe'
if (Test-Path -LiteralPath $legacyExe) {
    Remove-Item -LiteralPath $legacyExe -Force
}

$runtimeCandidates = @(
    Get-ChildItem -LiteralPath $coreRuntime -Filter '*.dll' -File
) | Sort-Object FullName -Unique

$references = $runtimeCandidates | Where-Object {
    try {
        [void][Reflection.AssemblyName]::GetAssemblyName($_.FullName)
        $true
    }
    catch {
        $false
    }
}

$references += Get-Item -LiteralPath (Join-Path $projectDir 'lib\Microsoft.FlightSimulator.SimConnect.dll')

$sources = Get-ChildItem -LiteralPath $projectDir -Filter '*.cs' -File -Recurse |
    Sort-Object FullName |
    Select-Object -ExpandProperty FullName

$arguments = @(
    '/nologo'
    '/noconfig'
    '/nostdlib+'
    '/target:exe'
    '/platform:x64'
    '/langversion:latest'
    '/nullable:enable'
    "/out:$outputDir\A320Boards.Bridge.dll"
)

$arguments += $references | ForEach-Object { "/reference:$($_.FullName)" }
$arguments += $sources

& $compiler @arguments
if ($LASTEXITCODE -ne 0) {
    throw "C# compilation failed with exit code $LASTEXITCODE"
}

Copy-Item -LiteralPath (Join-Path $projectDir 'lib\Microsoft.FlightSimulator.SimConnect.dll') -Destination $outputDir -Force
Copy-Item -LiteralPath (Join-Path $projectDir 'lib\SimConnect.dll') -Destination $outputDir -Force
Copy-Item -LiteralPath (Join-Path $projectDir 'A320Boards.Bridge.runtimeconfig.json') -Destination $outputDir -Force

if (-not (Test-Path -LiteralPath (Join-Path $webSourceDir 'index.html') -PathType Leaf)) {
    throw "Built web interface was not found at $webSourceDir. Run npm run build first."
}
if (Test-Path -LiteralPath $webOutputDir) {
    Remove-Item -LiteralPath $webOutputDir -Recurse -Force
}
Copy-Item -LiteralPath $webSourceDir -Destination $webOutputDir -Recurse

Write-Output "Built $outputDir\A320Boards.Bridge.dll and bundled $webOutputDir"
