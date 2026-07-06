param(
  [string]$ExtensionPath = ".output\chrome-mv3",
  [string]$ProfilePath = ".profiles\manual-linux-do-it-qa",
  [int]$RemoteDebuggingPort = 9222,
  [string]$StartUrl = "https://linux.do/posted"
)

$ErrorActionPreference = "Stop"

$ResolvedExtensionPath = Resolve-Path $ExtensionPath
New-Item -ItemType Directory -Force -Path $ProfilePath | Out-Null
$ResolvedProfilePath = Resolve-Path $ProfilePath

$PlaywrightChromiumCandidates = @()
if ($env:LOCALAPPDATA) {
  $PlaywrightRoot = Join-Path $env:LOCALAPPDATA "ms-playwright"
  if (Test-Path $PlaywrightRoot) {
    $PlaywrightChromiumCandidates = Get-ChildItem -Path $PlaywrightRoot -Directory -Filter "chromium-*" |
      Sort-Object Name -Descending |
      ForEach-Object {
        Get-ChildItem -Path $_.FullName -Recurse -Filter "chrome.exe" -ErrorAction SilentlyContinue |
          Select-Object -First 1 -ExpandProperty FullName
      }
  }
}

$ChromeCandidates = @(
  $env:CHROME_EXTENSION_DEV_BROWSER,
  $PlaywrightChromiumCandidates,
  $env:CHROME_PATH,
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | ForEach-Object { $_ } | Where-Object { $_ -and (Test-Path $_) }

$ChromePath = $ChromeCandidates | Select-Object -First 1
if (!(Test-Path $ChromePath)) {
  throw "Chrome not found. Set CHROME_PATH or install Chrome / Playwright Chromium."
}

Write-Host "Starting isolated Chrome for Linux Do It QA..."
Write-Host "Extension: $ResolvedExtensionPath"
Write-Host "Profile:   $ResolvedProfilePath"
Write-Host "CDP Port:  $RemoteDebuggingPort"
Write-Host "Start URL: $StartUrl"

& $ChromePath `
  --remote-debugging-port=$RemoteDebuggingPort `
  --user-data-dir="$ResolvedProfilePath" `
  --disable-extensions-except="$ResolvedExtensionPath" `
  --load-extension="$ResolvedExtensionPath" `
  $StartUrl
