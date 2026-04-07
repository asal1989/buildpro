require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = 3000;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'buildpro_erp',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

console.log('Starting simple server...');

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
  if (!token) return null;
  
  // Support both Authorization: Bearer token and x-auth-token
  if (token.startsWith('Bearer ')) {
    token = token.slice(7);
  }
  
  return sessions.get(token);
}

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  console.log('\n=== LOGIN REQUEST ===');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  
  const { userCode, password } = req.body;
  
  if (!userCode || !password) {
    console.log('Missing userCode or password');
    return res.status(400).json({ success: false, error: 'Missing credentials' });
  }
  
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE user_code = $1',
      [userCode]
    );
    
    console.log('Query result count:', result.rows.length);
    
    if (result.rows.length === 0) {
      console.log('User not found in database');
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    console.log('User found:', user.name);
    console.log('is_active:', user.is_active);
    
    if (user.is_active === false) {
      console.log('User is inactive');
      return res.status(401).json({ success: false, error: 'User is inactive' });
    }
    
    const valid = await bcrypt.compare(password, user.password_hash);
    console.log('Password valid:', valid);
    
    if (!valid) {
      console.log('Password invalid');
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    const token = createSession(user);
    console.log('Login SUCCESS! Token:', token.substring(0, 15));
    
    return res.json({
      success: true,
      data: {
        token: token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department
        }
      }
    });
    
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Protected endpoint test
app.get('/api/projects', (req, res) => {
  const token = req.headers['x-auth-token'];
  console.log('Projects request, token:', token ? 'provided' : 'NOT provided');
  
  if (!token || !getSession(token)) {
    console.log('Authentication failed - no valid session');
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  
  res.json({ success: true, data: [] });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server working!' });
});

// Settings (public)
app.get('/api/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM settings');
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = r.value; });
    res.json({ success: true, data: settings });
  } catch (err) {
    res.json({ success: true, data: {} });
  }
});

// Root - serve HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(50));
  console.log('🚀 Server running on http://localhost:3000');
  console.log('='.repeat(50));
  console.log('Login at: http://localhost:3000');
  console.log('Use: ADMIN / admin123');
  console.log('='.repeat(50));
});

module.exports = app;