@echo off
cd /d "%~dp0"

echo ============================================
echo   Gatennea Slider - Web (LAN access)
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

set "PORT=5173"

echo.
echo Starting LAN server on 0.0.0.0:%PORT% ...
start "GatenneaSlider-Server" cmd /c "node scripts\serve.mjs %PORT%"

rem 讓伺服器先起來
timeout /t 2 /nobreak >nul

rem 抓內網 IPv4（偏好私網）
for /f "delims=" %%i in ('node scripts\lanip.cjs') do set "LANIP=%%i"
if "%LANIP%"=="" set "LANIP=127.0.0.1"

start "" "http://%LANIP%:%PORT%/game.html"
echo.
echo LAN URL for OTHER devices: http://%LANIP%:%PORT%
echo (make sure firewall allows inbound on port %PORT%)
echo.
echo Done. This PC opened in browser; other LAN devices use the LAN URL above.
