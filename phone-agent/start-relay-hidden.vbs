' Hidden launcher for the PLDT relay autostart (runs at logon, no window).
' Called from the Startup folder by install-autostart.cmd.
Set sh = CreateObject("WScript.Shell")
sh.Run "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""C:\xampp\htdocs\3rdlaravel\phone-agent\start-relay.ps1"" -BootDelay 45", 0, False
