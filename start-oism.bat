@echo off
title OISM.institute - Sovereign Laptop Origin & Tunnel
cd /d "%~dp0"
echo ====================================================================
echo   Starting Omega Institute of Sovereign Mastery (OISM.institute)
echo   Local Origin: http://localhost:3848
echo   Tunnel Route: laptop-origin.oism.institute
echo ====================================================================
node supervisor.js
pause
