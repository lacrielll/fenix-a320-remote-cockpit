#ifndef MyAppVersion
  #define MyAppVersion "0.0.0-dev"
#endif
#ifndef MyNumericVersion
  #define MyNumericVersion "0.0.0"
#endif
#ifndef PublishDir
  #define PublishDir "..\release-staging\publish"
#endif
#ifndef OutputDir
  #define OutputDir "..\release-staging\installer"
#endif

[Setup]
AppId={{6AA95183-EF4C-4C50-A25D-5D0427B0D52A}
AppName=Fenix A320 Remote Cockpit
AppVersion={#MyAppVersion}
AppPublisher=lacrielll
AppPublisherURL=https://github.com/lacrielll/fenix-a320-remote-cockpit
AppSupportURL=https://github.com/lacrielll/fenix-a320-remote-cockpit/issues
AppUpdatesURL=https://github.com/lacrielll/fenix-a320-remote-cockpit/releases
DefaultDirName={autopf}\Fenix A320 Remote Cockpit
DefaultGroupName=Fenix A320 Remote Cockpit
DisableProgramGroupPage=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
PrivilegesRequired=admin
AppMutex=FenixA320RemoteCockpitBridge
OutputDir={#OutputDir}
OutputBaseFilename=Fenix-A320-Remote-Cockpit-{#MyAppVersion}-Setup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
InfoBeforeFile=prerequisites.txt
UninstallDisplayName=Fenix A320 Remote Cockpit
UninstallDisplayIcon={app}\runtime\dotnet.exe
VersionInfoVersion={#MyNumericVersion}
VersionInfoProductName=Fenix A320 Remote Cockpit
VersionInfoCompany=lacrielll
VersionInfoDescription=Browser-based remote cockpit for the Fenix A320

[Files]
Source: "{#PublishDir}\*"; DestDir: "{app}"; Excludes: "prerequisites\*"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "Install-MobiFlightModule.ps1"; DestDir: "{app}\tools"; Flags: ignoreversion
Source: "Show-ConnectionInfo.ps1"; DestDir: "{app}\tools"; Flags: ignoreversion
Source: "Start Remote Cockpit.cmd"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\mobiflight-event-module\*"; DestDir: "{app}\mobiflight-event-module"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\src\assets\cockpit\cockpit-layout.svg"; DestDir: "{app}\artwork\cockpit"; Flags: ignoreversion
Source: "..\src\assets\cockpit\airport-background.jpg"; DestDir: "{app}\artwork\cockpit"; Flags: ignoreversion
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\LICENSES.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\THIRD_PARTY_NOTICES.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\LICENSES\*"; DestDir: "{app}\LICENSES"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#PublishDir}\prerequisites\VC_redist.x64.exe"; DestDir: "{tmp}\fenix-remote-cockpit"; Flags: deleteafterinstall

[Icons]
Name: "{group}\Fenix A320 Remote Cockpit"; Filename: "{app}\Start Remote Cockpit.cmd"; WorkingDir: "{app}"
Name: "{group}\Connection information"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\tools\Show-ConnectionInfo.ps1"""; WorkingDir: "{app}"
Name: "{group}\Install or repair MobiFlight module"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\tools\Install-MobiFlightModule.ps1"" -Source ""{app}\mobiflight-event-module"""; WorkingDir: "{app}"
Name: "{autodesktop}\Fenix A320 Remote Cockpit"; Filename: "{app}\Start Remote Cockpit.cmd"; WorkingDir: "{app}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"

[InstallDelete]
Type: files; Name: "{app}\A320Boards.Bridge.exe"
Type: files; Name: "{app}\Microsoft.FlightSimulator.SimConnect.dll"
Type: files; Name: "{app}\SimConnect.dll"
Type: filesandordirs; Name: "{app}\web"
Type: filesandordirs; Name: "{app}\bridge"
Type: filesandordirs; Name: "{app}\runtime"
Type: filesandordirs; Name: "{app}\artwork"

[Run]
Filename: "{tmp}\fenix-remote-cockpit\VC_redist.x64.exe"; Parameters: "/install /quiet /norestart"; Flags: waituntilterminated; StatusMsg: "Installing the Microsoft Visual C++ runtime required by SimConnect..."
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\tools\Install-MobiFlightModule.ps1"" -Source ""{app}\mobiflight-event-module"""; Flags: waituntilterminated; StatusMsg: "Checking the MSFS Community folder and installing the MobiFlight WASM Module..."
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""Fenix A320 Remote Cockpit"""; Flags: runhidden waituntilterminated
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""Fenix A320 Remote Cockpit (TCP 8380)"""; Flags: runhidden waituntilterminated
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall add rule name=""Fenix A320 Remote Cockpit (TCP 8380)"" dir=in action=allow protocol=TCP localport=8380 profile=private"; Flags: runhidden waituntilterminated
Filename: "{app}\Start Remote Cockpit.cmd"; WorkingDir: "{app}"; Description: "Launch Fenix A320 Remote Cockpit"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""Fenix A320 Remote Cockpit"""; Flags: runhidden waituntilterminated
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""Fenix A320 Remote Cockpit (TCP 8380)"""; Flags: runhidden waituntilterminated
