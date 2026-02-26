Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Push-Location (Split-Path -Parent $PSScriptRoot)
try {
  & node "scripts/bootstrap-core.mjs"
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
