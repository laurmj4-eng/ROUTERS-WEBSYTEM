@echo off
REM Removes the PLDT relay autostart (Startup folder entry).
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
del /F /Q "%STARTUP%\PisoPldtRelay.vbs" >nul 2>&1
echo.
echo Autostart removed. The relay will no longer start at logon.
pause