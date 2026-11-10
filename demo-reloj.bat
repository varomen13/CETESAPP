@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0demo-reloj.ps1" %*
exit /b %errorlevel%
