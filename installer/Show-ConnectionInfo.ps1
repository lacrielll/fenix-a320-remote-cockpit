$ErrorActionPreference = 'SilentlyContinue'
$addresses = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
        $_.IPAddress -notlike '127.*' -and
        $_.IPAddress -notlike '169.254.*' -and
        $_.PrefixOrigin -ne 'WellKnown'
    } |
    Sort-Object InterfaceAlias, IPAddress |
    ForEach-Object { "http://$($_.IPAddress):8380/    [$($_.InterfaceAlias)]" }

$lines = @(
    'Start Fenix A320 Remote Cockpit first and keep its console window open.',
    '',
    'On this PC:',
    'http://localhost:8380/',
    '',
    'On another device connected to the same LAN or VPN:'
)
if ($addresses) {
    $lines += $addresses
}
else {
    $lines += 'No LAN IPv4 address was found.'
}
$lines += @(
    '',
    'Use the Wi-Fi or Ethernet address for a device on your home network.',
    'The Windows network profile must be Private.'
)

Add-Type -AssemblyName PresentationFramework
[System.Windows.MessageBox]::Show(($lines -join "`r`n"), 'Fenix A320 Remote Cockpit — connection information') | Out-Null

