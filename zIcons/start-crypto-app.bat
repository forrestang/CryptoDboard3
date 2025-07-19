@echo off
cd /d "C:\Users\lawfp\Desktop\CryptoDboard3"
echo Starting server...
start "Crypto Server" cmd /k "npm run dev"

echo Waiting for server to be ready...
:check
timeout /t 2 /nobreak >nul
powershell -Command "try { Invoke-WebRequest -Uri 'http://localhost:3000' -TimeoutSec 2 -UseBasicParsing | Out-Null; exit 0 } catch { exit 1 }"
if %errorlevel% neq 0 (
    echo Still waiting...
    goto check
)

echo Server is ready! Opening browser...
start "" http://localhost:3000