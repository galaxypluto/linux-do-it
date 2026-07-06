$ErrorActionPreference = "Stop"

if (!(Test-Path "package.json")) {
  throw "Run this script from the extension project root."
}

pnpm install --workspace-root
pnpm dev
