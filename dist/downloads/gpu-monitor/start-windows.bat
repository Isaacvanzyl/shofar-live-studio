@echo off
title Shofar Hub — GPU Monitor
color 0A
cls

echo.
echo  ===================================
echo   SHOFAR HUB  -  GPU Monitor
echo  ===================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo  Node.js is not installed.
    echo.
    echo  Please follow these steps:
    echo    1. Press any key to open the Node.js download page
    echo    2. Download and install the "LTS" version
    echo    3. Restart your computer
    echo    4. Double-click this file again
    echo.
    pause
    start https://nodejs.org
    exit
)

:: First-time setup: install dependencies
if not exist "%~dp0node_modules\systeminformation" (
    echo  First-time setup: installing dependencies...
    echo  This only happens once. Please wait.
    echo.
    cd /d "%~dp0"
    call npm install --save systeminformation 2>nul
    echo.
    echo  Done!
    echo.
)

cd /d "%~dp0"
echo  Starting...
echo.
node gpu-monitor.js

echo.
echo  GPU Monitor stopped.
pause
