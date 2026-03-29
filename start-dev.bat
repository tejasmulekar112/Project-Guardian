@echo off
echo ============================================
echo   Project Guardian - Dev Server Startup
echo ============================================
echo.

:: Kill old processes
echo [1/4] Killing old processes...
taskkill /F /IM uvicorn.exe >nul 2>&1
taskkill /F /IM ngrok.exe >nul 2>&1

:: Kill any process on port 8000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000.*LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: Kill any process on port 8081 (Expo)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8081.*LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 2 /nobreak >nul
echo    Done.
echo.

:: Start backend
echo [2/4] Starting backend server on port 8000...
start "Guardian-Backend" cmd /k "cd /d d:\Projects\SOS_app\backend && python -m poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000"
timeout /t 4 /nobreak >nul
echo    Backend started.
echo.

:: Start ngrok
echo [3/4] Starting ngrok tunnel...
start "Guardian-Ngrok" cmd /k "npx ngrok http 8000"
timeout /t 5 /nobreak >nul
echo    Ngrok started.
echo.

:: Get ngrok URL and update .env
echo [4/4] Getting ngrok URL and updating mobile .env...
timeout /t 3 /nobreak >nul

for /f "delims=" %%u in ('curl -s http://localhost:4040/api/tunnels ^| python -c "import sys,json; print(json.load(sys.stdin)[\"tunnels\"][0][\"public_url\"])"') do set NGROK_URL=%%u

if defined NGROK_URL (
    echo    Ngrok URL: %NGROK_URL%

    :: Update mobile .env
    > d:\Projects\SOS_app\mobile\.env.tmp echo EXPO_PUBLIC_API_URL=%NGROK_URL%
    for /f "usebackq delims=" %%L in ("d:\Projects\SOS_app\mobile\.env") do (
        echo %%L | findstr /v "EXPO_PUBLIC_API_URL" >nul && >> d:\Projects\SOS_app\mobile\.env.tmp echo %%L
    )
    move /y d:\Projects\SOS_app\mobile\.env.tmp d:\Projects\SOS_app\mobile\.env >nul

    echo    Mobile .env updated with ngrok URL.
) else (
    echo    WARNING: Could not get ngrok URL. Update mobile\.env manually.
)

echo.

:: Start Expo
echo Starting Expo dev server...
echo.
cd /d d:\Projects\SOS_app\mobile
npx expo start
