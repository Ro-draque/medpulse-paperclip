param([ValidateSet('onboard','run','doctor')][string]$Action = 'run')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
$cliPath = Join-Path $projectRoot '.runtime/paperclip/node_modules/paperclipai/dist/index.js'
if (!(Test-Path -LiteralPath $cliPath)) { throw 'Paperclip no está instalado. Ver docs/ETAPA-2.md.' }
$env:PAPERCLIP_NO_BROWSER = 'true'
$env:PAPERCLIP_OPEN_ON_LISTEN = 'false'
$dataPath = Join-Path $projectRoot '.runtime/paperclip-data'
if ($Action -eq 'onboard') {
  & node $cliPath onboard --yes --no-install-service --data-dir $dataPath
} else {
  & node $cliPath $Action --data-dir $dataPath
}
exit $LASTEXITCODE
