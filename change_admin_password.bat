@echo off
title Huawei CGI Password Reset
cd /d "%~dp0local-agent"
cls
echo ================================================
echo   Huawei HG8145X6-10 CGI Password Reset
echo ================================================
echo.
echo This will open a visible browser and change
echo the admin password WITHOUT knowing the current one.
echo.
set /p NEW_PW="Enter new admin password (min 8 chars): "
if "%NEW_PW%"=="" set NEW_PW=Admin12345678
echo.
echo [*] Launching visible browser...
echo [*] Watch the browser window that opens.
echo.
node cgi_password_reset.cjs --password "%NEW_PW%" --visible --keep-open
echo.
echo [*] Browser kept open. Close it manually when done.
echo [*] Press any key to exit.
pause >nul
