@echo off
cd /d "%~dp0"

echo ============================================
echo   Gatennea Slider - Debug server (Ctrl+C to stop)
echo ============================================

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found.
  pause
  exit /b 1
)

if not exist node_modules (
  echo First run: installing typescript ...
  call npm install --ignore-scripts --no-audit --no-fund
)

echo Building ...
call npm run build
if errorlevel 1 (
  echo [ERROR] Build failed.
  pause
  exit /b 1
)

echo Starting debug server at http://127.0.0.1:5173 ...
start "" http://127.0.0.1:5173
call npm run dev
