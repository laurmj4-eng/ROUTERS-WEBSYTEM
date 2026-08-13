@echo off
REM Installs the PLDT relay autostart: copies a hidden VBS launcher into the
REM Windows Startup folder (runs at every logon, no window, no admin needed).
REM The PC must auto-login to Windows for this to fire.
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
copy /Y "%~dp0start-relay-hidden.vbs" "%STARTUP%\PisoPldtRelay.vbs" >nul
if %errorlevel% neq 0 (
    echo.
    echo FAILED to install. Check the Startup folder path:
    echo %STARTUP%
    pause
    exit /b 1
)
echo.
echo Installed. The relay will start automatically at every Windows logon.
echo To verify:  dir "%STARTUP%\PisoPldtRelay.vbs"
echo To remove:  double-click uninstall-autostart.cmd
pause