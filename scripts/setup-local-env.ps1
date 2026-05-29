# Configura DATABASE_URL em apps/web/.env.local a partir do Neon (neonctl).
# Requer: npm i -g neonctl (ou npx neonctl) e login: neonctl auth

$ErrorActionPreference = 'Stop'
$ProjectId = $env:NEON_PROJECT_ID
if (-not $ProjectId) { $ProjectId = 'plain-voice-62077000' }

$cs = (npx neonctl connection-string --project-id $ProjectId --pooled 2>$null).Trim()
if ($cs -notmatch '^postgresql://') {
  Write-Error "Não foi possível obter a connection string. Rode: npx neonctl auth"
}

$envPath = Join-Path $PSScriptRoot '..\apps\web\.env.local' | Resolve-Path -ErrorAction SilentlyContinue
if (-not $envPath) {
  $envPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'apps\web\.env.local'
}

"DATABASE_URL=`"$cs`"`n" | Set-Content -Path $envPath -Encoding utf8 -NoNewline
Write-Host "OK: DATABASE_URL gravado em $envPath"
Write-Host "Reinicie o servidor: npm run dev"
