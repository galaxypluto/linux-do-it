param(
  [string]$ExtensionPath = ".output\chrome-mv3",
  [string]$ProfilePath = ".profiles\manual-bootstrap",
  [string]$TargetUrl = ""
)

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path $ProfilePath | Out-Null
$ResolvedProfilePath = Resolve-Path $ProfilePath
$ResolvedExtensionPath = Resolve-Path $ExtensionPath

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

Write-Host "Opening isolated Chrome profile for manual login bootstrap."
Write-Host "Do not use your personal profile. Use a dedicated test account."
Write-Host "Profile: $ResolvedProfilePath"

$args = @(
  "--user-data-dir=$ResolvedProfilePath",
  "--disable-extensions-except=$ResolvedExtensionPath",
  "--load-extension=$ResolvedExtensionPath"
)

if ($TargetUrl -ne "") {
  $args += $TargetUrl
}

& $ChromePath @args
