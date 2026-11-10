$ErrorActionPreference = 'Stop'

$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
if (-not (Test-Path $adb)) {
  $adbCommand = Get-Command adb -ErrorAction SilentlyContinue
  if ($null -eq $adbCommand) {
    throw 'No se encontró adb. Instala Android SDK Platform-Tools o agrega adb al PATH.'
  }
  $adb = $adbCommand.Source
}

$devices = & $adb devices
if ($LASTEXITCODE -ne 0) {
  throw 'adb no pudo consultar los dispositivos conectados.'
}

$watchSerial = $null
foreach ($line in $devices | Select-Object -Skip 1) {
  if ($line -match '^(\S+)\s+device$') {
    $serial = $Matches[1]
    $characteristics = & $adb -s $serial shell getprop ro.build.characteristics
    if ($LASTEXITCODE -eq 0 -and $characteristics -match 'watch') {
      $watchSerial = $serial
      break
    }
  }
}

if ($null -eq $watchSerial) {
  throw 'No se detectó un emulador Wear OS conectado. Inícialo y vuelve a ejecutar este script.'
}

& $adb -s $watchSerial forward tcp:8765 tcp:8765
if ($LASTEXITCODE -ne 0) {
  throw "No se pudo crear el puente ADB para el reloj $watchSerial."
}

Write-Output "Puente activo para el reloj ${watchSerial}: localhost:8765 -> reloj:8765."
