# 将当前插件目录发布为独立 Git 仓库（供 monorepo 维护者使用）
param(
  [string]$TargetDir = "",
  [string]$Remote = "https://github.com/galaxypluto/linux-do-it.git",
  [switch]$Push,
  [switch]$CreateRepo
)

$ErrorActionPreference = "Stop"
$SourceDir = Split-Path $PSScriptRoot -Parent
if (-not $TargetDir) {
  $MonorepoRoot = Split-Path (Split-Path $SourceDir -Parent) -Parent
  $TargetDir = Join-Path (Split-Path $MonorepoRoot -Parent) "linux-do-it"
}
$TargetDir = [System.IO.Path]::GetFullPath($TargetDir)

Write-Host "Source: $SourceDir"
Write-Host "Target: $TargetDir"

$Exclude = @(
  "node_modules",
  ".output",
  ".profiles",
  "test-results",
  "playwright-report",
  ".wxt"
)

New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null

Get-ChildItem -Path $SourceDir -Force | Where-Object {
  $Exclude -notcontains $_.Name
} | ForEach-Object {
  $dest = Join-Path $TargetDir $_.Name
  if ($_.PSIsContainer) {
    if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
    Copy-Item -Path $_.FullName -Destination $dest -Recurse -Force
  } else {
    Copy-Item -Path $_.FullName -Destination $dest -Force
  }
}

Push-Location $TargetDir
try {
  if (-not (Test-Path ".git")) {
    git init -b main
  }

  pnpm install
  pnpm typecheck
  pnpm test
  pnpm build

  git add -A
  $status = git status --porcelain
  if ($status) {
    git commit -m @"
chore: Linux Do It v1.0.0 standalone repository bootstrap

Extracted from Chrome-EXE monorepo plugins/linux-do-it.
"@
  }

  if ($CreateRepo) {
    gh repo create galaxypluto/linux-do-it --public --source . --remote origin --description "Chrome extension: enhanced Linux.do reading with card view, Reader, and side panel search." 2>$null
    if ($LASTEXITCODE -ne 0) {
      git remote remove origin 2>$null
      git remote add origin $Remote
    }
  } elseif (-not (git remote get-url origin 2>$null)) {
    git remote add origin $Remote
  }

  if ($Push) {
    git tag -f v1.0.0
    git push -u origin main --force
    git push origin v1.0.0 --force
    pnpm zip
    $zip = Get-ChildItem -Path ".output" -Filter "*.zip" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($zip) {
      gh release upload v1.0.0 $zip.FullName --clobber 2>$null
      if ($LASTEXITCODE -ne 0) {
        gh release create v1.0.0 $zip.FullName --title "v1.0.0" --notes "First public release of Linux Do It."
      }
    }
  }
} finally {
  Pop-Location
}

Write-Host "Done. Standalone tree at: $TargetDir"
