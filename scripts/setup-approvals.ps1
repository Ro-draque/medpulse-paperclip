$ErrorActionPreference = 'Stop'
$private = Join-Path $env:LOCALAPPDATA 'MEDPULSE-Approvals'
if (!(Test-Path -LiteralPath $private)) { New-Item -ItemType Directory -Path $private | Out-Null }
$item = Get-Item -LiteralPath $private
if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'La carpeta privada no puede ser un enlace.' }
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
$acl = Get-Acl -LiteralPath $private
$acl.SetAccessRuleProtection($true, $false)
foreach ($rule in @($acl.Access)) { $acl.RemoveAccessRuleAll($rule) }
$owner = [Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
$acl.SetAccessRule($owner)
Set-Acl -LiteralPath $private -AclObject $acl
& node (Join-Path $PSScriptRoot 'approvals-server.mjs') --setup
if ($LASTEXITCODE -ne 0) { throw 'No se pudo inicializar el centro.' }
Write-Output "Credenciales privadas: $private\credenciales-demo.txt"
