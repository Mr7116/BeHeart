@echo off
REM Pushes BeHeart to https://github.com/Mr7116/BeHeart (run once from this folder).
cd /d "%~dp0"
if not exist .git (
  git init -b main
  git remote add origin https://github.com/Mr7116/BeHeart.git
)
git add -A
git commit -m "BeHeart: iPhone app with Apple Watch + Bluetooth heart-rate sensors, iOS .ipa build workflow"
git push -u origin main
echo.
echo Done. Open https://github.com/Mr7116/BeHeart/actions to watch the iOS build.
pause
