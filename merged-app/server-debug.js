// ============================================
// BuildPro ERP - Debug Version
// ============================================

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

console.log('Starting server...');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'buildpro_erp',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

pool.query('SELECT NOW()')
  .then(() => console.log('✅ Database connected'))
  .catch(err => console.error('❌ DB Error:', err.message));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const sessions = new Map();

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId: user.id, name: user.name, role: user.role });
  return token;
}

function getSession(token) {
  return sessions.get(token);
}

// Login - NO AUTH REQUIRED
app.post('/api/auth/login', async (req, res) => {
  console.log('\n=== LOGIN REQUEST ===');
  console.log('Body:', req.body);
  
  const { userCode, password } = req.body;
  
  if (!userCode || !password) {
    console.log('Missing credentials');
    return res.status(400).json({ success: false, error: 'Missing credentials' });
  }
  
  try {
    console.log('Looking for user:', userCode);
    const result = await pool.query(
      'SELECT * FROM users WHERE user_code = $1',
      [userCode]
    );
    
    console.log('Found rows:', result.rows.length);
    
    if (result.rows.length === 0) {
      console.log('User not found');
      return res.status(401).json({ success: false, error: 'Invalid credentials - user not found' });
    }
    
    const user = result.rows[0];
    console.log('User:', user.name, 'is_active:', user.is_active);
    console.log('Password hash:', user.password_hash);
    
    if (user.is_active === false) {
      return res.status(401).json({ success: false, error: 'User is inactive' });
    }
    
    // Test password
    const valid = await bcrypt.compare(password, user.password_hash);
    console.log('Password valid:', valid);
    
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials - wrong password' });
    }
    
    const token = createSession(user);
    console.log('Login SUCCESS! Token:', token.substring(0, 10) + '...');
    
    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, name: user.name, role: user.role, department: user.department }
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true });
});

// Projects (protected)
app.get('/api/projects', async (req, res) => {
  const token = req.headers['x-auth-token'];
  if (!token || !getSession(token)) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  const result = await pool.query('SELECT * FROM projects');
  res.json({ success: true, data: result.rows });
});

// Vendors
app.get('/api/vendors', async (req, res) => {
  const token = req.headers['x-auth-token'];
  if (!token || !getSession(token)) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  const result = await pool.query('SELECT * FROM vendors WHERE is_active = true');
  res.json({ success: true, data: result.rows });
});

// Indents
app.get('/api/indents', async (req, res) => {
  const token = req.headers['x-auth-token'];
  if (!token || !getSession(token)) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  const result = await pool.query('SELECT i.*, p.project_name FROM material_indents i LEFT JOIN projects p ON i.project_id = p.id ORDER BY i.created_at DESC');
  res.json({ success: true, data: result.rows });
});

// Bills
app.get('/api/bills', async (req, res) => {
  const token = req.headers['x-auth-token'];
  if (!token || !getSession(token)) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  const result = await pool.query('SELECT b.*, p.project_name FROM bills b LEFT JOIN projects p ON b.project_id = p.id ORDER BY b.created_at DESC');
  res.json({ success: true, data: result.rows });
});

// Settings
app.get('/api/settings', async (req, res) => {
  const result = await pool.query('SELECT * FROM settings');
  const settings = {};
  result.rows.forEach(r => settings[r.key] = r.value);
  res.json({ success: true, data: settings });
});

// Root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

module.exports = app;
