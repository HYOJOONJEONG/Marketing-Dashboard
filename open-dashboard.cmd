@echo off
cd /d "%~dp0"
start "Marketing Dashboard Server" cmd /k C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe -Command "$env:Path='C:\Program Files\nodejs;' + $env:Path; & 'C:\Program Files\nodejs\corepack.cmd' pnpm dev --port 3002"
timeout /t 4 >nul
start "" http://127.0.0.1:3002
