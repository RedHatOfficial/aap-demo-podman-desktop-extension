param(
  [Parameter(Mandatory = $true)]
  [string]$InstallScript
)

$ErrorActionPreference = 'Stop'

$candidates = @(
  (Join-Path $env:ProgramFiles 'Git\bin\bash.exe'),
  (Join-Path $env:ProgramFiles 'Git\usr\bin\bash.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Git\bin\bash.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Git\usr\bin\bash.exe')
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

$gitCommand = Get-Command git.exe -ErrorAction SilentlyContinue
if ($gitCommand) {
  $gitRoot = Split-Path -Parent (Split-Path -Parent $gitCommand.Source)
  $candidates += @(
    (Join-Path $gitRoot 'bin\bash.exe'),
    (Join-Path $gitRoot 'usr\bin\bash.exe')
  ) | Where-Object { Test-Path -LiteralPath $_ }
}

$bash = $candidates | Select-Object -First 1
if (-not $bash) {
  throw 'Git for Windows Bash was not found. Install Git for Windows, restart Podman Desktop, and try again.'
}

if (-not (Test-Path -LiteralPath $InstallScript)) {
  throw "Install script not found: $InstallScript"
}

$bashScript = $InstallScript -replace '\\', '/'
& $bash $bashScript
exit $LASTEXITCODE
