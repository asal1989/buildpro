@echo off
echo ========================================
echo   BuildPro ERP - Quick Fix Script
echo ========================================
echo.

cd /d "%~dp0"

echo Step 1: Installing dependencies...
npm install express pg cors bcrypt dotenv multer

echo.
echo Step 2: Checking database connection...
node -e "require('dotenv').config(); const {Pool} = require('pg'); const p = new Pool({host:process.env.DB_HOST||'localhost', port:process.env.DB_PORT||5432, database:process.env.DB_NAME||'buildpro_erp', user:process.env.DB_USER||'postgres', password:process.env.DB_PASSWORD||'postgres'}); p.query('SELECT 1').then(()=>{console.log('DB OK'); process.exit(0)}).catch(e=>{console.log('DB ERROR: '+e.message); process.exit(1)})"

if errorlevel 1 (
    echo.
    echo ERROR: Cannot connect to database!
    echo Check your .env file has correct DB_PASSWORD
    pause
    exit /b 1
)

echo.
echo Step 3: Testing login...
node -e "
require('dotenv').config();
const {Pool} = require('pg');
const bcrypt = require('bcrypt');
const p = new Pool({host:process.env.DB_HOST||'localhost', port:process.env.DB_PORT||5432, database:process.env.DB_NAME||'buildpro_erp', user:process.env.DB_USER||'postgres', password:process.env.DB_PASSWORD||'postgres'});
p.query('SELECT * FROM users WHERE user_code = \$1', ['ADMIN']).then(r => {
    if(r.rows.length === 0) { console.log('ERROR: User not found in DB'); process.exit(1); }
    const u = r.rows[0];
    console.log('User found:', u.name, 'is_active:', u.is_active);
    bcrypt.compare('admin123', u.password_hash).then(v => {
        console.log('Password valid:', v);
        if(v) console.log('SUCCESS: Login should work!');
        else console.log('ERROR: Password hash mismatch');
        process.exit(0);
    });
}).catch(e => { console.log('ERROR:', e.message); process.exit(1); });
"

echo.
echo ========================================
echo If everything shows OK, try running:
echo   npm start
echo Then open http://localhost:3000
echo Login: ADMIN / admin123
echo ========================================
pause