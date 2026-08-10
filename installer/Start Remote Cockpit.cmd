@echo off
title Fenix A320 Remote Cockpit
cd /d "%~dp0"
echo Starting Fenix A320 Remote Cockpit...
echo.
"%~dp0runtime\dotnet.exe" exec "%~dp0bridge\A320Boards.Bridge.dll"
if errorlevel 1 (
  echo.
  echo The remote cockpit stopped with an error.
  echo Copy the complete message above when reporting the problem.
  pause
)

