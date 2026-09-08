@echo off
cd /d "%~dp0"

echo ============================================
echo   Gatennea Slider - Web (double-click play)
echo ============================================

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install from https://nodejs.org first.
  pause
  exit /b 1
)

if not exist node_modules (
  echo First run: installing typescript ...
  call npm install --ignore-scripts --no-audit --no-fund
)

echo Building (tsc + bundle app.js) ...
call npm run build
if errorlevel 1 (
  echo [ERROR] Build failed. See messages above.
  pause
  exit /b 1
)

echo Opening index.html ...
start "" "%~dp0index.html"

echo Done. If the browser did not open, double-click index.html manually.
