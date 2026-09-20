@echo off
cd /d "%~dp0"
title vClyps Release Manager
echo.
echo   Starting the Release Manager...
echo   Your browser will open on its own in a few seconds.
echo.
echo   Keep this window open while you use it. Closing it stops the app.
echo.

REM Opens the browser once the server has had time to come up. Run detached so
REM it does not hold up the server starting below.
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep 5; Start-Process 'http://localhost:5173/'"

REM Vite is started through node directly rather than `npm run dev`, so this
REM works even on a shell where npm is not on the PATH.
node node_modules\vite\bin\vite.js --port 5173

echo.
echo   The Release Manager has stopped.
pause
