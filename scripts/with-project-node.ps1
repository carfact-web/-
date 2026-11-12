$ErrorActionPreference = 'Stop'
$taskRepo = Split-Path -Parent $PSScriptRoot
$taskNodeDir = Join-Path (Split-Path -Parent $taskRepo) 'carfact-tools/node-v22.23.0-win-x64'
$taskNode = Join-Path $taskNodeDir 'node.exe'
if (!(Test-Path -LiteralPath $taskNode)) { throw 'Project Node 22.23.0 missing. See docs/local-windows.md.' }
if ((& $taskNode --version) -ne 'v22.23.0') { throw 'Expected Node 22.23.0.' }
if ($args.Count -eq 0) { throw 'Usage: scripts/with-project-node.ps1 <node|npm|npx> [arguments...]' }
$taskCommand = $args[0]
if ($taskCommand -notin @('node', 'npm', 'npx')) { throw 'Allowed commands: node, npm, npx.' }
$taskRemaining = @($args | Select-Object -Skip 1)
$taskOldPath = $env:PATH
try {
  $env:PATH = $taskNodeDir + [IO.Path]::PathSeparator + $taskOldPath
  $taskExecutable = Join-Path $taskNodeDir $(if ($taskCommand -eq 'node') { 'node.exe' } else { $taskCommand + '.cmd' })
  & $taskExecutable @taskRemaining
  exit $LASTEXITCODE
} finally { $env:PATH = $taskOldPath }
