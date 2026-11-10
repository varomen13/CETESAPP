$ErrorActionPreference = 'Stop'

$projectRoot = $PSScriptRoot
$envFile = Join-Path $projectRoot 'mobile\.env'
$apiBase = 'https://www.banxico.org.mx/SieAPIRest/service/v1'
$seriesByTerm = [ordered]@{
  28 = 'SF43936'
  91 = 'SF43939'
  182 = 'SF43942'
  364 = 'SF43945'
}

$token = $env:BANXICO_API_TOKEN
if ([string]::IsNullOrWhiteSpace($token) -and (Test-Path $envFile)) {
  $tokenLine = Get-Content $envFile | Where-Object { $_ -match '^\s*BANXICO_API_TOKEN\s*=' } | Select-Object -First 1
  if ($tokenLine -match '^\s*BANXICO_API_TOKEN\s*=\s*(.*?)\s*$') {
    $token = $Matches[1].Trim().Trim('"').Trim("'")
  }
}
if ([string]::IsNullOrWhiteSpace($token)) {
  throw 'Configura BANXICO_API_TOKEN en mobile\.env o en el entorno para consultar Banxico.'
}

$headers = @{ 'Bmx-Token' = $token }
$startDate = [DateTime]::UtcNow.AddDays(-180).ToString('yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture)
$endDate = [DateTime]::UtcNow.ToString('yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture)
$rates = foreach ($entry in $seriesByTerm.GetEnumerator()) {
  $term = [int]$entry.Key
  $seriesId = [string]$entry.Value
  $metadata = Invoke-RestMethod -Uri "$apiBase/series/$seriesId" -Headers $headers -TimeoutSec 15
  $title = [string]$metadata.bmx.series[0].titulo
  if ([string]::IsNullOrWhiteSpace($title) -or $title -notmatch '(?i)cetes' -or $title -notmatch [string]$term) {
    throw "Banxico no confirmo la serie CETES de $term dias."
  }

  $response = Invoke-RestMethod -Uri "$apiBase/series/$seriesId/datos/$startDate/$endDate" -Headers $headers -TimeoutSec 20
  $observations = foreach ($observation in $response.bmx.series[0].datos) {
    $parts = ([string]$observation.fecha).Split('/')
    $rate = 0.0
    if (
      $parts.Length -eq 3 -and
      [double]::TryParse(
        [string]$observation.dato,
        [Globalization.NumberStyles]::Float,
        [Globalization.CultureInfo]::InvariantCulture,
        [ref]$rate
      )
    ) {
      $date = [DateTime]::new([int]$parts[2], [int]$parts[1], [int]$parts[0])
      [pscustomobject]@{ Date = $date; Rate = $rate }
    }
  }
  $latest = $observations | Sort-Object Date | Select-Object -Last 1
  if ($null -eq $latest) {
    throw "Banxico no devolvio tasas validas para CETES de $term dias."
  }
  [pscustomobject]@{ term = $term; annualRate = $latest.Rate }
}

$rates = @($rates | Sort-Object term)
$bestRate = $rates | Sort-Object annualRate -Descending | Select-Object -First 1
$now = [DateTime]::UtcNow
$amount = 1000.0
$pricePerPiece = 10 / (1 + ($bestRate.annualRate / 100) * ($bestRate.term / 360))
$pieces = [Math]::Floor($amount / $pricePerPiece)
$principal = $pieces * $pricePerPiece
$maturityValue = $pieces * 10
$snapshot = [ordered]@{
  rates = $rates
  ratesFetchedAt = $now.ToString('yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture)
  bestTerm = $bestRate.term
  lastCalculation = [ordered]@{
    name = "Calculo CETES $($bestRate.term) dias"
    principal = $principal
    term = $bestRate.term
    annualRate = $bestRate.annualRate
    estimatedReturn = $maturityValue - $principal
    maturityValue = $maturityValue
    maturityDate = $now.AddDays($bestRate.term).ToString('yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture)
  }
  favorites = @()
  notifications = [ordered]@{
    maturityRemindersEnabled = $false
    favoriteRateChangesEnabled = $false
  }
}
$payload = $snapshot | ConvertTo-Json -Depth 6 -Compress
$payloadBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($payload))

$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
if (-not (Test-Path $adb)) {
  $adbCommand = Get-Command adb -ErrorAction SilentlyContinue
  if ($null -eq $adbCommand) {
    throw 'No se encontro adb. Instala Android SDK Platform-Tools o agrega adb al PATH.'
  }
  $adb = $adbCommand.Source
}
$devices = & $adb devices
if ($LASTEXITCODE -ne 0) {
  throw 'adb no pudo consultar los dispositivos conectados.'
}
$watchDevice = $null
foreach ($line in $devices | Select-Object -Skip 1) {
  if ($line -match '^(\S+)\s+device$') {
    $serial = $Matches[1]
    $characteristics = & $adb -s $serial shell getprop ro.build.characteristics
    if ($LASTEXITCODE -eq 0 -and $characteristics -match 'watch') {
      $watchDevice = $serial
      break
    }
  }
}
if ($null -eq $watchDevice) {
  throw 'No se detecto un reloj Wear OS conectado. Inicia Wear_OS_Large_Round o conecta un reloj.'
}

& $adb -s $watchDevice shell am broadcast `
  -a 'com.cetessmart.wear.DEBUG_SNAPSHOT' `
  -n 'com.cetessmartmobile/com.cetessmart.wear.DebugSnapshotReceiver' `
  --es 'payloadBase64' $payloadBase64
if ($LASTEXITCODE -ne 0) {
  throw 'No se pudo enviar la instantanea al reloj.'
}
$rateSummary = ($rates | ForEach-Object {
  "$($_.term): $($_.annualRate.ToString('0.00', [Globalization.CultureInfo]::InvariantCulture))%"
}) -join ', '
Write-Output "Instantanea de Banxico enviada al reloj $watchDevice."
Write-Output "Tasas oficiales actuales: $rateSummary. Plazo con mayor tasa: $($bestRate.term) dias."
