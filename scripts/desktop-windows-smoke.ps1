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

function Get-CommandPath([string]$CommandLine) {
  $value = $CommandLine.Trim()
  if ($value -match '^"([^"]+)"') { return $Matches[1] }
  return ($value -split '\s+')[0].Trim('"')
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
$uninstaller = Get-CommandPath $uninstallString

$rawInstallLocation = [string]$entry.InstallLocation
$installDir = if (-not [string]::IsNullOrWhiteSpace($rawInstallLocation)) {
  $rawInstallLocation.Trim().Trim('"')
} else {
  (Split-Path -Parent $uninstaller).Trim().Trim('"')
}
Assert-True (-not [string]::IsNullOrWhiteSpace($installDir)) 'Could not determine GrindLobby install directory.'
Assert-True (Test-Path $installDir) "GrindLobby install directory does not exist: $installDir"

$appCandidates = @(
  (Join-Path $installDir 'GrindLobby.exe'),
  (Join-Path $installDir 'grindlobby-desktop.exe')
) | Where-Object { Test-Path $_ }
if ($appCandidates.Count -eq 0) {
  $appCandidates = @(Get-ChildItem -Path $installDir -Filter '*.exe' -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -ne $uninstaller -and $_.Name -notmatch 'unins|uninstall' } |
    Select-Object -ExpandProperty FullName)
}
Assert-True ($appCandidates.Count -gt 0) "No installed GrindLobby application executable was found in $installDir"
$appExe = $appCandidates[0]
$processName = [IO.Path]::GetFileNameWithoutExtension($appExe)
Write-Host "Installed executable: $appExe"

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

  $running = @(Get-Process -Name $processName -ErrorAction SilentlyContinue)
  Assert-True ($running.Count -eq 1) "Expected one $processName process, found $($running.Count)."

  $second = Start-Process -FilePath $appExe -PassThru
  Start-Sleep -Seconds 3
  $runningAfterSecondLaunch = @(Get-Process -Name $processName -ErrorAction SilentlyContinue)
  Assert-True ($runningAfterSecondLaunch.Count -eq 1) "Single-instance guard failed; found $($runningAfterSecondLaunch.Count) $processName processes."

  $afterWebView = @(Get-Process -Name 'msedgewebview2' -ErrorAction SilentlyContinue)
  $newWebView = @($afterWebView | Where-Object { $beforeWebView -notcontains $_.Id })
  Assert-True ($newWebView.Count -gt 0) 'No WebView2 child process appeared after launching GrindLobby.'

  $appProcesses = @(Get-Process -Name $processName -ErrorAction SilentlyContinue)
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
  Get-Process -Name $processName -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
  if (Test-Path $uninstaller) {
    Start-Process -FilePath $uninstaller -ArgumentList '/S' -Wait -NoNewWindow
    Start-Sleep -Seconds 2
  }
}

Assert-True (-not (Test-Path $appExe)) 'Silent uninstall left the GrindLobby application executable behind.'
Assert-True ($null -eq (Get-GrindEntry)) 'Silent uninstall left GrindLobby registry metadata behind.'
Write-Host 'Desktop install/runtime/single-instance/resource/uninstall smoke test passed.'
