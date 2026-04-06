@echo off
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM cmd.exe /FI "WINDOWTITLE eq Marketing Dashboard Server" >nul 2>&1
echo Dashboard server stopped.
pause
