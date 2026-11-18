@echo off
title Lead & Job Agent - Local Server
cd /d %~dp0
echo =======================================================
echo    Lead & Job Generator Agent (XAMPP & MySQL)
echo =======================================================
echo.
echo Database: MySQL (localhost:3306 / lead_job_agent)
echo App URL:  http://localhost:3777
echo.
echo Starting Node server...
node server.js
pause
