[CmdletBinding()]
param(
  [string]$Version,
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\artifacts\msix'),
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $projectRoot

$identityName = 'DevJamStudio.622382E8743A9'
$publisher = 'CN=300C6CAC-B727-40B2-8FF0-4C00EBAF31D9'
$publisherDisplayName = 'Dev Jam Studio'

$tauriConfigPath = Join-Path $projectRoot 'src-tauri\tauri.conf.json'
$tauriConfig = Get-Content -LiteralPath $tauriConfigPath -Raw | ConvertFrom-Json
$appVersion = [string]$tauriConfig.version

if ([string]::IsNullOrWhiteSpace($Version)) {
  $Version = $appVersion
} elseif ($Version -ne $appVersion) {
  throw "Requested app version '$Version' does not match tauri.conf.json version '$appVersion'."
}

if ($Version -notmatch '^(\d+)\.(\d+)\.(\d+)$') {
  throw "Version '$Version' must contain exactly three numeric components, such as 0.16.0."
}

$appMajor = [int]$Matches[1]
$appMinor = [int]$Matches[2]
$appPatch = [int]$Matches[3]
$packageMajor = $appMajor + 1

foreach ($component in @($packageMajor, $appMinor, $appPatch)) {
  if ($component -lt 0 -or $component -gt 65535) {
    throw "Version '$Version' cannot be mapped to a valid Microsoft Store package version."
  }
}

# The Store requires a four-part package version whose first component is non-zero
# and reserves the fourth component. Offset the semantic major by one so pre-1.0
# PLAY. versions remain monotonic: 0.16.0 -> 1.16.0.0, 1.0.0 -> 2.0.0.0.
$packageVersion = "$packageMajor.$appMinor.$appPatch.0"

if (-not $SkipBuild) {
  & bun run setup-lib
  if ($LASTEXITCODE -ne 0) {
    throw "bun run setup-lib failed with exit code $LASTEXITCODE."
  }

  & bun run tauri build --no-bundle
  if ($LASTEXITCODE -ne 0) {
    throw "Tauri build failed with exit code $LASTEXITCODE."
  }
}

$makeAppxCommand = Get-Command makeappx.exe -ErrorAction SilentlyContinue | Select-Object -First 1
if ($makeAppxCommand) {
  $makeAppx = $makeAppxCommand.Source
} else {
  $makeAppx = Get-ChildItem `
    -Path (Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin') `
    -Filter makeappx.exe `
    -Recurse `
    -File `
    -ErrorAction SilentlyContinue |
    Where-Object { $_.Directory.Name -eq 'x64' } |
    Sort-Object FullName |
    Select-Object -Last 1 -ExpandProperty FullName
}

if (-not $makeAppx) {
  throw 'makeappx.exe was not found in the installed Windows SDK.'
}

$binary = Join-Path $projectRoot 'src-tauri\target\release\playdot-player.exe'
$libDirectory = Join-Path $projectRoot 'src-tauri\lib'
$shaderDirectory = Join-Path $projectRoot 'shaders'
$icon = Join-Path $projectRoot 'src-tauri\icons\128x128@2x.png'
$manifestTemplate = Join-Path $projectRoot 'packaging\msix\AppxManifest.xml.in'

foreach ($requiredFile in @($binary, $icon, $manifestTemplate)) {
  if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
    throw "Required MSIX input is missing: $requiredFile"
  }
}
foreach ($requiredDirectory in @($libDirectory, $shaderDirectory)) {
  if (-not (Test-Path -LiteralPath $requiredDirectory -PathType Container)) {
    throw "Required MSIX input directory is missing: $requiredDirectory"
  }
}

$requiredRuntimeFiles = @(
  (Join-Path $libDirectory 'libmpv-wrapper.dll'),
  (Join-Path $libDirectory 'libmpv-2.dll'),
  (Join-Path $shaderDirectory 'FSR.glsl'),
  (Join-Path $shaderDirectory 'adaptive-luma-ultra.glsl')
)
foreach ($requiredRuntimeFile in $requiredRuntimeFiles) {
  if (-not (Test-Path -LiteralPath $requiredRuntimeFile -PathType Leaf)) {
    throw "Required packaged runtime file is missing: $requiredRuntimeFile"
  }
}

if ([System.IO.Path]::IsPathRooted($OutputDirectory)) {
  $outputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
} else {
  $outputDirectory = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputDirectory))
}
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$packagePath = Join-Path $outputDirectory "PLAY_$Version`_x64.msix"

$stagingRoot = Join-Path ([System.IO.Path]::GetTempPath()) "playdot-msix-$([guid]::NewGuid().ToString('N'))"
$verificationRoot = Join-Path ([System.IO.Path]::GetTempPath()) "playdot-msix-verify-$([guid]::NewGuid().ToString('N'))"
$stagingAssets = Join-Path $stagingRoot 'Assets'
$stagingLib = Join-Path $stagingRoot 'lib'
$stagingShaders = Join-Path $stagingRoot 'shaders'

try {
  New-Item -ItemType Directory -Path $stagingAssets, $stagingLib, $stagingShaders -Force | Out-Null

  Copy-Item -LiteralPath $binary -Destination (Join-Path $stagingRoot 'playdot-player.exe') -Force
  Copy-Item -Path (Join-Path $libDirectory '*') -Destination $stagingLib -Recurse -Force
  Copy-Item -Path (Join-Path $shaderDirectory '*') -Destination $stagingShaders -Recurse -Force

  Add-Type -AssemblyName System.Drawing
  function Write-ScaledPng([string]$SourcePath, [string]$DestinationPath, [int]$Width, [int]$Height) {
    $sourceImage = [System.Drawing.Image]::FromFile($SourcePath)
    $bitmap = [System.Drawing.Bitmap]::new($Width, $Height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.DrawImage($sourceImage, 0, 0, $Width, $Height)
      $bitmap.Save($DestinationPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $graphics.Dispose()
      $bitmap.Dispose()
      $sourceImage.Dispose()
    }
  }

  Write-ScaledPng $icon (Join-Path $stagingAssets 'StoreLogo.png') 50 50
  Write-ScaledPng $icon (Join-Path $stagingAssets 'Square44x44Logo.png') 44 44
  Write-ScaledPng $icon (Join-Path $stagingAssets 'Square150x150Logo.png') 150 150

  $manifest = Get-Content -LiteralPath $manifestTemplate -Raw
  $manifest = $manifest.Replace('__PACKAGE_VERSION__', $packageVersion)
  if ($manifest.Contains('__PACKAGE_VERSION__')) {
    throw 'The MSIX manifest package version token was not replaced.'
  }

  $manifestPath = Join-Path $stagingRoot 'AppxManifest.xml'
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($manifestPath, $manifest, $utf8NoBom)

  [xml]$manifestXml = $manifest
  $identity = $manifestXml.Package.Identity
  if ($identity.Name -ne $identityName -or $identity.Publisher -ne $publisher) {
    throw 'The generated manifest identity does not match the reserved Microsoft Store identity.'
  }
  if ($manifestXml.Package.Properties.PublisherDisplayName -ne $publisherDisplayName) {
    throw 'The generated manifest publisher display name does not match Partner Center.'
  }

  if (Test-Path -LiteralPath $packagePath) {
    Remove-Item -LiteralPath $packagePath -Force
  }

  & $makeAppx pack /v /h SHA256 /d $stagingRoot /p $packagePath /o
  if ($LASTEXITCODE -ne 0) {
    throw "makeappx.exe failed with exit code $LASTEXITCODE."
  }

  New-Item -ItemType Directory -Path $verificationRoot -Force | Out-Null
  & $makeAppx unpack /p $packagePath /d $verificationRoot /o
  if ($LASTEXITCODE -ne 0) {
    throw "makeappx.exe could not unpack the generated package (exit code $LASTEXITCODE)."
  }

  foreach ($packagedFile in @(
    'playdot-player.exe',
    'lib\libmpv-wrapper.dll',
    'lib\libmpv-2.dll',
    'shaders\FSR.glsl',
    'shaders\adaptive-luma-ultra.glsl',
    'AppxManifest.xml'
  )) {
    $verifiedPath = Join-Path $verificationRoot $packagedFile
    if (-not (Test-Path -LiteralPath $verifiedPath -PathType Leaf)) {
      throw "Generated MSIX is missing required file: $packagedFile"
    }
  }

  Write-Host "Unsigned Microsoft Store MSIX written to $packagePath" -ForegroundColor Green
  Write-Host "PLAY. version: $Version"
  Write-Host "Store package version: $packageVersion"
  Write-Host "Identity: $identityName"
  Write-Host "Publisher: $publisher"
  Write-Host 'The Microsoft Store will sign the package after certification.'
} finally {
  Remove-Item -LiteralPath $stagingRoot -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $verificationRoot -Recurse -Force -ErrorAction SilentlyContinue
}
