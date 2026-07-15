$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$bundleRoot = Join-Path $projectRoot "src-tauri\target\release\bundle"
$nsisRoot = Join-Path $bundleRoot "nsis"
$outputRoot = Join-Path $projectRoot "release"

if (-not (Test-Path -LiteralPath $nsisRoot)) {
  throw "NSIS output not found at '$nsisRoot'. Run 'bun run release:win' first."
}

$installer = Get-ChildItem -LiteralPath $nsisRoot -File -Filter "*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($null -eq $installer) {
  throw "No installer executable found in '$nsisRoot'."
}

$version = (Get-Content -Raw (Join-Path $projectRoot "package.json") | ConvertFrom-Json).version
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$releaseDir = Join-Path $outputRoot "v$version-$stamp"
New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null

$installerDest = Join-Path $releaseDir $installer.Name
$latestInstallerDest = Join-Path $releaseDir "PLAY._x64-setup.exe"
Copy-Item -LiteralPath $installer.FullName -Destination $installerDest -Force
Copy-Item -LiteralPath $installer.FullName -Destination $latestInstallerDest -Force

$checksumValue = $null
if (Get-Command Get-FileHash -ErrorAction SilentlyContinue) {
  $checksumValue = (Get-FileHash -LiteralPath $installerDest -Algorithm SHA256).Hash
} else {
  $hashOutput = certutil -hashfile $installerDest SHA256
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to compute SHA256 checksum for '$installerDest'."
  }
  $checksumValue = ($hashOutput | Select-Object -Skip 1 | Select-Object -First 1).Trim().Replace(" ", "")
}

$latestChecksumValue = $null
if (Get-Command Get-FileHash -ErrorAction SilentlyContinue) {
  $latestChecksumValue = (Get-FileHash -LiteralPath $latestInstallerDest -Algorithm SHA256).Hash
} else {
  $hashOutput = certutil -hashfile $latestInstallerDest SHA256
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to compute SHA256 checksum for '$latestInstallerDest'."
  }
  $latestChecksumValue = ($hashOutput | Select-Object -Skip 1 | Select-Object -First 1).Trim().Replace(" ", "")
}

$checksumLine = @(
  "{0} *{1}" -f $checksumValue, $installer.Name
  "{0} *PLAY._x64-setup.exe" -f $latestChecksumValue
)
$checksumPath = Join-Path $releaseDir "SHA256SUMS.txt"
Set-Content -LiteralPath $checksumPath -Value $checksumLine -Encoding ascii

Write-Host "Release artifacts created:"
Write-Host "  Installer: $installerDest"
Write-Host "  Latest:    $latestInstallerDest"
Write-Host "  SHA256:    $checksumPath"
