@echo off
echo ============================================
echo   BuildPro ERP - Merged Application Starter
echo ============================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

REM Check if PostgreSQL connection works
echo Checking PostgreSQL connection...
node -e "const { Pool } = require('pg'); const p = new Pool({host:'localhost', port:5432, database:'buildpro_erp', user:'postgres', password:'postgres'}); p.query('SELECT 1').then(()=>{console.log('Database OK');process.exit(0)}).catch(e=>{console.log('Database Error: ' + e.message);process.exit(1)})" 2>nul
if errorlevel 1 (
    echo.
    echo ERROR: Cannot connect to PostgreSQL database!
    echo.
    echo Please ensure:
    echo   1. PostgreSQL is installed and running
    echo   2. Database 'buildpro_erp' exists
    echo   3. Run 'schema.sql' to create tables
    echo.
    echo To create database, run:
    echo   createdb buildpro_erp
    echo   psql -d buildpro_erp -f schema.sql
    echo.
    pause
    exit /b 1
)

echo.
echo Starting BuildPro ERP...
echo.
cd /d "%~dp0"
npm start

pause