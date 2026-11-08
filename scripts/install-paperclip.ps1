$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
$installPath = Join-Path $projectRoot '.runtime/paperclip'
New-Item -ItemType Directory -Force $installPath | Out-Null
Copy-Item -LiteralPath 'runtime/package.json','runtime/pnpm-lock.yaml','runtime/pnpm-workspace.yaml' -Destination $installPath -Force
$storePath = Join-Path $projectRoot '.runtime/pnpm-store'
$cachePath = Join-Path $projectRoot '.runtime/pnpm-cache'
& pnpm --dir $installPath --config.node-linker=hoisted "--config.store-dir=$storePath" "--config.cache-dir=$cachePath" install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { throw 'La instalación no terminó correctamente.' }
& node (Join-Path $installPath 'node_modules/paperclipai/dist/index.js') --version
