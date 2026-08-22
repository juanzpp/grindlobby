param(
  [Parameter(Mandatory=$true)][string]$Installer
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}

function Get-GrindEntry {
  $roots = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )
  foreach ($root in $roots) {
    $entry = Get-ItemProperty $root -ErrorAction SilentlyContinue |
      Where-Object { $_.DisplayName -eq 'GrindLobby' } |
      Select-Object -First 1
    if ($entry) { return $entry }
  }
  return $null
}

function Get-CpuTotal([int[]]$Pids) {
  $total = 0.0
  foreach ($id in $Pids) {
    $process = Get-Process -Id $id -ErrorAction SilentlyContinue
    if ($process) { $total += [double]$process.CPU }
  }
  return $total
}

$installerPath = (Resolve-Path $Installer).Path
Write-Host "Installing: $installerPath"
Start-Process -FilePath $installerPath -ArgumentList '/S' -Wait -NoNewWindow

$entry = Get-GrindEntry
Assert-True ($null -ne $entry) 'GrindLobby uninstall registry entry was not created.'

$uninstallString = [string]$entry.UninstallString
Assert-True (-not [string]::IsNullOrWhiteSpace($uninstallString)) 'GrindLobby uninstall command is missing.'
$uninstaller = $uninstallString.Trim().Trim('"')
$installDir = if (-not [string]::IsNullOrWhiteSpace([string]$entry.InstallLocation)) {
  [string]$entry.InstallLocation
} else {
  Split-Path -Parent $uninstaller
}
$appExe = Join-Path $installDir 'GrindLobby.exe'
Assert-True (Test-Path $appExe) "Installed GrindLobby.exe was not found at $appExe"

$version = (Get-Item $appExe).VersionInfo.ProductVersion
Assert-True ($version -like '0.1.1*') "Unexpected desktop version: $version"
Write-Host "Installed version: $version"

$installerSignature = Get-AuthenticodeSignature $installerPath
$appSignature = Get-AuthenticodeSignature $appExe
Write-Host "Installer signature: $($installerSignature.Status)"
Write-Host "Application signature: $($appSignature.Status)"
if ($env:REQUIRE_WINDOWS_SIGNATURE -eq 'true') {
  Assert-True ($installerSignature.Status -eq 'Valid') 'Installer is not Authenticode signed.'
  Assert-True ($appSignature.Status -eq 'Valid') 'Application binary is not Authenticode signed.'
}

$beforeWebView = @(Get-Process -Name 'msedgewebview2' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$process = $null

try {
  $process = Start-Process -FilePath $appExe -ArgumentList '--self-test' -PassThru
  Start-Sleep -Seconds 5
  $process.Refresh()
  Assert-True (-not $process.HasExited) "GrindLobby exited during startup with code $($process.ExitCode)."

  & node "$PSScriptRoot\desktop-runtime-smoke.mjs"
  Assert-True ($LASTEXITCODE -eq 0) 'Desktop WebView2 runtime smoke test failed.'

  $running = @(Get-Process -Name 'GrindLobby' -ErrorAction SilentlyContinue)
  Assert-True ($running.Count -eq 1) "Expected one GrindLobby process, found $($running.Count)."

  $second = Start-Process -FilePath $appExe -PassThru
  Start-Sleep -Seconds 3
  $runningAfterSecondLaunch = @(Get-Process -Name 'GrindLobby' -ErrorAction SilentlyContinue)
  Assert-True ($runningAfterSecondLaunch.Count -eq 1) "Single-instance guard failed; found $($runningAfterSecondLaunch.Count) GrindLobby processes."

  $afterWebView = @(Get-Process -Name 'msedgewebview2' -ErrorAction SilentlyContinue)
  $newWebView = @($afterWebView | Where-Object { $beforeWebView -notcontains $_.Id })
  Assert-True ($newWebView.Count -gt 0) 'No WebView2 child process appeared after launching GrindLobby.'

  $appProcesses = @(Get-Process -Name 'GrindLobby' -ErrorAction SilentlyContinue)
  $workingSetBytes = ($appProcesses | Measure-Object -Property WorkingSet64 -Sum).Sum + ($newWebView | Measure-Object -Property WorkingSet64 -Sum).Sum
  $workingSetMb = [math]::Round($workingSetBytes / 1MB, 1)
  Write-Host "Desktop working set (app + new WebView2 processes): $workingSetMb MB"
  Assert-True ($workingSetMb -lt 900) "Desktop idle working set is unexpectedly high: $workingSetMb MB"

  $runtimePids = @($appProcesses.Id) + @($newWebView.Id)
  $cpuStart = Get-CpuTotal $runtimePids
  Start-Sleep -Seconds 10
  $cpuEnd = Get-CpuTotal $runtimePids
  $cpuDelta = [math]::Round($cpuEnd - $cpuStart, 2)
  Write-Host "Desktop CPU time over 10s idle sample: $cpuDelta s"
  Assert-True ($cpuDelta -lt 15) "Desktop idle CPU use is unexpectedly high: $cpuDelta CPU-seconds over 10 seconds."
}
finally {
  Get-Process -Name 'GrindLobby' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
  if (Test-Path $uninstaller) {
    Start-Process -FilePath $uninstaller -ArgumentList '/S' -Wait -NoNewWindow
    Start-Sleep -Seconds 2
  }
}

Assert-True (-not (Test-Path $appExe)) 'Silent uninstall left GrindLobby.exe behind.'
Assert-True ($null -eq (Get-GrindEntry)) 'Silent uninstall left GrindLobby registry metadata behind.'
Write-Host 'Desktop install/runtime/single-instance/resource/uninstall smoke test passed.'
