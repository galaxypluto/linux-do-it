param(
  [string]$ExtensionPath = ".output\chrome-mv3",
  [string]$ProfilePath = ".profiles\agent-chrome",
  [int]$RemoteDebuggingPort = 9222
)

$ErrorActionPreference = "Stop"

$ResolvedExtensionPath = Resolve-Path $ExtensionPath
New-Item -ItemType Directory -Force -Path $ProfilePath | Out-Null
$ResolvedProfilePath = Resolve-Path $ProfilePath

$ChromeCandidates = @(
  $env:CHROME_PATH,
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { $_ -and (Test-Path $_) }

$ChromePath = $ChromeCandidates | Select-Object -First 1
if (!(Test-Path $ChromePath)) {
  throw "Chrome not found. Set CHROME_PATH or install Chrome stable."
}

Write-Host "Starting isolated Chrome for agent debugging..."
Write-Host "Extension: $ResolvedExtensionPath"
Write-Host "Profile:   $ResolvedProfilePath"
Write-Host "CDP Port:  $RemoteDebuggingPort"

& $ChromePath `
  --remote-debugging-port=$RemoteDebuggingPort `
  --user-data-dir="$ResolvedProfilePath" `
  --disable-extensions-except="$ResolvedExtensionPath" `
  --load-extension="$ResolvedExtensionPath"
