@echo off
cd /d C:\Users\Franz\Desktop\invoice-tracker\backend

:retry
echo [%date% %time%] Attempting npm install resend... >> npm-install.log
call npm install resend --no-audit --no-fund --fetch-timeout=20000 --fetch-retries=2 --fetch-retry-mintimeout=1000 --fetch-retry-maxtimeout=3000 >> npm-install.log 2>&1

if exist node_modules\resend\package.json (
  echo [%date% %time%] SUCCESS - resend installed >> npm-install.log
  exit /b 0
)

echo [%date% %time%] Install failed, retrying in 15s... >> npm-install.log
timeout /t 15 /nobreak >nul
goto retry
