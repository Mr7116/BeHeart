# Captures every screen into shots/ for a visual check (free and premium).
param([switch]$Premium)
$electron = Join-Path $PSScriptRoot '..\node_modules\electron\dist\electron.exe'
$app = Join-Path $PSScriptRoot '..'
foreach ($s in 'today','trends','sleep','cardio','workouts','nutrition','health','premium','profile') {
  $args = @($app, '--screenshot', "shots/$s$(if ($Premium) {'-pro'}).png", '--screen', $s)
  if ($Premium) { $args += '--premium' }
  Start-Process -FilePath $electron -ArgumentList $args -Wait -NoNewWindow
}
