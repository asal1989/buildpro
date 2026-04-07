require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const nodemailer = require('nodemailer');

// Email Transporter Configuration
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    }
  });
};

// Send Email Helper
async function sendEmail(to, subject, html) {
  try {
    const transporter = createEmailTransporter();
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"BuildPro ERP" <noreply@buildpro.com>',
      to,
      subject,
      html
    });
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('Email error:', err.message);
    return { success: false, error: err.message };
  }
}

// Email Templates
function getEmailTemplate(type, data) {
  const templates = {
    'indent_approved': {
      subject: 'Material Indent Approved - BuildPro ERP',
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #C17B3A;">✅ Material Indent Approved</h2>
        <p>Dear <strong>${data.userName}</strong>,</p>
        <p>Your Material Indent <strong>${data.indentNumber}</strong> has been <strong>APPROVED</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd;">Project</td><td style="padding: 8px; border: 1px solid #ddd;">${data.projectName}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;">Item</td><td style="padding: 8px; border: 1px solid #ddd;">${data.itemDescription}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;">Quantity</td><td style="padding: 8px; border: 1px solid #ddd;">${data.quantity} ${data.unit}</td></tr>
        </table>
        <p>Please proceed with the purchase order process.</p>
        <p style="color: #666; font-size: 12px;">BuildPro ERP System</p>
      </div>`
    },
    'indent_rejected': {
      subject: 'Material Indent Rejected - BuildPro ERP',
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #B83A3A;">❌ Material Indent Rejected</h2>
        <p>Dear <strong>${data.userName}</strong>,</p>
        <p>Your Material Indent <strong>${data.indentNumber}</strong> has been <strong>REJECTED</strong>.</p>
        <p><strong>Reason:</strong> ${data.reason || 'Not specified'}</p>
        <p style="color: #666; font-size: 12px;">BuildPro ERP System</p>
      </div>`
    },
    'po_created': {
      subject: 'New Purchase Order Created - BuildPro ERP',
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2D6FA8;">📋 New Purchase Order</h2>
        <p>Dear <strong>${data.userName}</strong>,</p>
        <p>A new Purchase Order <strong>${data.poNumber}</strong> has been created.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd;">Vendor</td><td style="padding: 8px; border: 1px solid #ddd;">${data.vendorName}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;">Amount</td><td style="padding: 8px; border: 1px solid #ddd;">₹${data.total}</td></tr>
        </table>
        <p style="color: #666; font-size: 12px;">BuildPro ERP System</p>
      </div>`
    },
    'bill_approved': {
      subject: 'Bill Approved - BuildPro ERP',
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2A7A4B;">✅ Bill Approved</h2>
        <p>Dear <strong>${data.userName}</strong>,</p>
        <p>Bill <strong>${data.billNo}</strong> has been <strong>APPROVED</strong> for payment.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd;">Amount</td><td style="padding: 8px; border: 1px solid #ddd;">₹${data.amount}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;">Approved By</td><td style="padding: 8px; border: 1px solid #ddd;">${data.approvedBy}</td></tr>
        </table>
        <p style="color: #666; font-size: 12px;">BuildPro ERP System</p>
      </div>`
    },
    'bill_paid': {
      subject: 'Bill Paid - BuildPro ERP',
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2A7A4B;">💰 Bill Paid</h2>
        <p>Dear <strong>${data.userName}</strong>,</p>
        <p>Bill <strong>${data.billNo}</strong> has been <strong>PAID</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd;">Amount</td><td style="padding: 8px; border: 1px solid #ddd;">₹${data.amount}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;">Paid By</td><td style="padding: 8px; border: 1px solid #ddd;">${data.paidBy}</td></tr>
        </table>
        <p style="color: #666; font-size: 12px;">BuildPro ERP System</p>
      </div>`
    },
    'new_user': {
      subject: 'Welcome to BuildPro ERP',
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #C17B3A;">🎉 Welcome to BuildPro ERP!</h2>
        <p>Dear <strong>${data.userName}</strong>,</p>
        <p>Your account has been created.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd;">User Code</td><td style="padding: 8px; border: 1px solid #ddd;">${data.userCode}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;">Role</td><td style="padding: 8px; border: 1px solid #ddd;">${data.role}</td></tr>
        </table>
        <p>Please login at: <a href="http://localhost:3000">BuildPro Login</a></p>
        <p style="color: #666; font-size: 12px;">BuildPro ERP System</p>
      </div>`
    }
  };
  return templates[type] || null;
}

const app = express();
const PORT = 3000;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'buildpro_erp',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

console.log('Starting BuildPro ERP Server with full API...');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// Sessions
const sessions = new Map();

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId: user.id, name: user.name, role: user.role, projectId: user.project_id });
  return token;
}

function getSession(token) {
  if (!token) return null;
  if (token.startsWith('Bearer ')) token = token.slice(7);
  return sessions.get(token);
}

// Auth middleware
function requireAuth(req, res, next) {
  const token = req.headers['x-auth-token'] || (req.headers['authorization'] || '').replace('Bearer ', '');
  if (!token || !getSession(token)) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const session = getSession(token);
  req.user = session;
  req.userId = session.userId;
  req.userName = session.name;
  req.userRole = session.role;
  next();
}

// Role-Based Access Control (RBAC) middleware
const ROLES = {
  ADMIN: ['ADMIN'],
  DIRECTOR: ['ADMIN', 'DIRECTOR'],
  MANAGER: ['ADMIN', 'DIRECTOR', 'MANAGER'],
  USER: ['ADMIN', 'DIRECTOR', 'MANAGER', 'USER'],
  VIEWER: ['ADMIN', 'DIRECTOR', 'MANAGER', 'USER', 'VIEWER']
};

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const userRole = req.userRole;
    if (!userRole) {
      return res.status(403).json({ error: 'Role not defined' });
    }
    
    const allowed = allowedRoles.flat();
    if (!allowed.includes(userRole) && !allowed.includes('ADMIN')) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
}

// Check if user has permission for specific action
function hasPermission(userRole, permission) {
  const permissions = {
    // Users management
    'users:create': ['ADMIN'],
    'users:edit': ['ADMIN', 'DIRECTOR'],
    'users:delete': ['ADMIN'],
    
    // Projects
    'projects:create': ['ADMIN', 'DIRECTOR', 'MANAGER'],
    'projects:edit': ['ADMIN', 'DIRECTOR', 'MANAGER'],
    'projects:delete': ['ADMIN', 'DIRECTOR'],
    
    // Vendors
    'vendors:create': ['ADMIN', 'DIRECTOR', 'MANAGER'],
    'vendors:edit': ['ADMIN', 'DIRECTOR', 'MANAGER'],
    'vendors:delete': ['ADMIN', 'DIRECTOR'],
    
    // Indents
    'indents:create': ['ADMIN', 'DIRECTOR', 'MANAGER', 'USER'],
    'indents:approve': ['ADMIN', 'DIRECTOR', 'MANAGER'],
    'indents:edit': ['ADMIN', 'DIRECTOR', 'MANAGER', 'USER'],
    'indents:delete': ['ADMIN', 'DIRECTOR'],
    
    // Purchase Orders
    'po:create': ['ADMIN', 'DIRECTOR', 'MANAGER'],
    'po:edit': ['ADMIN', 'DIRECTOR', 'MANAGER'],
    'po:delete': ['ADMIN', 'DIRECTOR'],
    'po:approve': ['ADMIN', 'DIRECTOR'],
    
    // Bills
    'bills:create': ['ADMIN', 'DIRECTOR', 'MANAGER', 'USER'],
    'bills:approve': ['ADMIN', 'DIRECTOR'],
    'bills:payment': ['ADMIN', 'DIRECTOR'],
    'bills:edit': ['ADMIN', 'DIRECTOR', 'MANAGER'],
    'bills:delete': ['ADMIN', 'DIRECTOR'],
    
    // Reports
    'reports:export': ['ADMIN', 'DIRECTOR', 'MANAGER'],
    'reports:view': ['ADMIN', 'DIRECTOR', 'MANAGER', 'USER'],
    
    // Backup
    'backup:create': ['ADMIN'],
    'backup:restore': ['ADMIN'],
    
    // Settings
    'settings:edit': ['ADMIN'],
    'settings:view': ['ADMIN', 'DIRECTOR', 'MANAGER']
  };
  
  const allowedRoles = permissions[permission] || [];
  return allowedRoles.includes(userRole) || ROLES.ADMIN.includes(userRole);
}

// Public paths
const publicPaths = ['/api/auth/login', '/api/auth/register', '/api/health', '/api/settings', '/api/dashboard-stats'];
app.use('/api', (req, res, next) => {
  if (publicPaths.includes(req.path)) return next();
  return requireAuth(req, res, next);
});

// ============================================
// AUTHENTICATION
// ============================================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { userCode, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE user_code = $1', [userCode]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    
    const user = result.rows[0];
    if (user.is_active === false) return res.status(401).json({ error: 'User is inactive' });
    
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    
    const token = createSession(user);
    res.json({ 
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/me', (req, res) => {
  const token = req.headers['x-auth-token'] || (req.headers['authorization'] || '').replace('Bearer ', '');
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ success: true, ...session });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers['x-auth-token'] || (req.headers['authorization'] || '').replace('Bearer ', '');
  if (token) sessions.delete(token);
  res.json({ success: true });
});

// ============================================
// PROJECTS
// ============================================

app.get('/api/projects', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const { name, code, color, icon } = req.body;
    const result = await pool.query(
      `INSERT INTO projects (project_name, project_code, status) VALUES ($1, $2, 'Active') RETURNING *`,
      [name, code]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, color, icon, status } = req.body;
    const result = await pool.query(
      `UPDATE projects SET project_name = COALESCE($1, project_name), project_code = COALESCE($2, project_code), status = COALESCE($3, status) WHERE id = $4 RETURNING *`,
      [name, code, status, id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// VENDORS
// ============================================

app.get('/api/vendors', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vendors WHERE is_active = true ORDER BY vendor_name');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vendors', async (req, res) => {
  try {
    const { vendorCode, vendorName, contactPerson, email, phone, address } = req.body;
    const result = await pool.query(
      `INSERT INTO vendors (vendor_code, vendor_name, contact_person, email, phone, address, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING *`,
      [vendorCode, vendorName, contactPerson, email, phone, address]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/vendors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { vendorName, contactPerson, email, phone, address } = req.body;
    const result = await pool.query(
      `UPDATE vendors SET vendor_name = $1, contact_person = $2, email = $3, phone = $4, address = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *`,
      [vendorName, contactPerson, email, phone, address, id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/vendors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE vendors SET is_active = false WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// INDENTS (Material Requests)
// ============================================

app.get('/api/indents', async (req, res) => {
  try {
    const { status } = req.query;
    let query = `SELECT i.*, p.project_name FROM material_indents i LEFT JOIN projects p ON i.project_id = p.id`;
    if (status) query += ` WHERE i.status = $1`;
    query += ' ORDER BY i.created_at DESC';
    const result = status ? await pool.query(query, [status]) : await pool.query(query);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/indents/:indentNo/approve', async (req, res) => {
  try {
    const { indentNo } = req.params;
    const result = await pool.query(
      `UPDATE material_indents SET status = 'Approved', approved_by = $1, approved_on = CURRENT_TIMESTAMP WHERE indent_number = $2 RETURNING *`,
      [req.userName, indentNo]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// PURCHASE ORDERS
// ============================================

app.get('/api/po', async (req, res) => {
  try {
    const { type } = req.query;
    let query = `SELECT po.*, v.vendor_name FROM purchase_orders po LEFT JOIN vendors v ON po.vendor_id = v.id`;
    if (type) query += ` WHERE po.status = $1`;
    query += ' ORDER BY po.created_at DESC';
    const result = type ? await pool.query(query, [type]) : await pool.query(query);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/po/full', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT po.*, v.vendor_name, p.project_name FROM purchase_orders po 
       LEFT JOIN vendors v ON po.vendor_id = v.id 
       LEFT JOIN projects p ON po.project_id = p.id
       ORDER BY po.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/po', async (req, res) => {
  try {
    const { vendorId, projectId, itemDescription, quantity, rate, total, status } = req.body;
    const result = await pool.query(
      `INSERT INTO purchase_orders (vendor_id, project_id, item_description, quantity, rate, total, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [vendorId, projectId, itemDescription, quantity, rate, total, status || 'Issued']
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/po/:poNum', async (req, res) => {
  try {
    const { poNum } = req.params;
    await pool.query('DELETE FROM purchase_orders WHERE po_number = $1', [poNum]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GRN (Goods Received Note)
// ============================================

app.get('/api/grn', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT g.*, po.po_number, v.vendor_name FROM grn g 
       LEFT JOIN purchase_orders po ON g.po_id = po.id 
       LEFT JOIN vendors v ON po.vendor_id = v.id
       ORDER BY g.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/grn', async (req, res) => {
  try {
    const { poId, grnNumber, receivedDate, quantityReceived, condition, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO grn (po_id, grn_number, received_date, quantity_received, condition, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [poId, grnNumber, receivedDate, quantityReceived, condition, notes]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// INVOICES
// ============================================

app.get('/api/invoice-requests', async (req, res) => {
  try {
    const { status } = req.query;
    let query = `SELECT i.*, po.po_number, v.vendor_name FROM invoices i 
                 LEFT JOIN purchase_orders po ON i.po_id = po.id 
                 LEFT JOIN vendors v ON po.vendor_id = v.id`;
    if (status) query += ` WHERE i.status = $1`;
    query += ' ORDER BY i.created_at DESC';
    const result = status ? await pool.query(query, [status]) : await pool.query(query);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/invoice-requests', async (req, res) => {
  try {
    const { poId, invoiceNumber, invoiceDate, amount, taxAmount, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO invoices (po_id, invoice_number, invoice_date, amount, tax_amount, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'Pending') RETURNING *`,
      [poId, invoiceNumber, invoiceDate, amount, taxAmount, notes]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// MATERIAL TRACKER (Bill Tracker)
// ============================================

app.get('/api/material-tracker', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT mt.*, p.project_name FROM material_tracker_items mt
       LEFT JOIN projects p ON mt.project_id = p.id
       ORDER BY mt.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/material-tracker/meta', async (req, res) => {
  try {
    const projects = await pool.query('SELECT id, project_name FROM projects');
    const vendors = await pool.query('SELECT id, vendor_name FROM vendors WHERE is_active = true');
    res.json({ success: true, data: { projects: projects.rows, vendors: vendors.rows } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/material-tracker', async (req, res) => {
  try {
    const fields = [];
    const values = [];
    let idx = 1;
    
    const allowedFields = [
      'project_id', 'team_name', 'head_name', 'responsibility', 'item_code',
      'item_description', 'unit', 'mr_no', 'mr_date', 'pm_cert_date', 'qs_cert_date',
      'material_required_date', 'mr_qty', 'material_receipt_date_site',
      'vendor_name', 'po_no', 'po_date', 'ordered_qty', 'unit_price', 'procurement_days',
      'po_gst_pct', 'po_value_basic', 'po_value_with_tax',
      'invoice_number', 'invoice_date', 'invoice_qty', 'material_received_qty',
      'balance_qty_to_be_supplied', 'invoice_sent_to_ho_date',
      'qs_remarks', 'certified_qty', 'qty_certified_by_qs', 'rate', 'basic_amount',
      'amount_certified_by_qs_for_payment', 'total_amount_certified_by_qs',
      'workflow_status', 'remarks'
    ];
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        fields.push(field);
        values.push(req.body[field]);
      }
    }
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields provided' });
    }
    
    const result = await pool.query(
      `INSERT INTO material_tracker_items (${fields.join(', ')}) VALUES (${values.map((_, i) => '$' + (i+1)).join(', ')}) RETURNING *`,
      values
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/material-tracker/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fields = [];
    const values = [];
    let idx = 1;
    
    for (const [key, val] of Object.entries(req.body)) {
      fields.push(`${key} = $${idx++}`);
      values.push(val);
    }
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    const result = await pool.query(
      `UPDATE material_tracker_items SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/material-tracker/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM material_tracker_items WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// BILLS (Bill Tracker)
// ============================================

app.get('/api/bills', async (req, res) => {
  try {
    const { type } = req.query;
    let query = `SELECT b.*, p.project_name FROM bills b LEFT JOIN projects p ON b.project_id = p.id`;
    if (type) query += ` WHERE b.status = $1`;
    query += ' ORDER BY b.created_at DESC';
    const result = type ? await pool.query(query, [type]) : await pool.query(query);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bills/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, p.project_name FROM bills b LEFT JOIN projects p ON b.project_id = p.id ORDER BY b.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const upload = multer({ dest: path.join(__dirname, 'uploads') });

app.post('/api/bills', upload.single('file'), async (req, res) => {
  try {
    const { projectId, billNo, billDate, description, amount, taxAmount, totalAmount, vendorName, invoiceNo, invoiceDate, submittedBy, submittedDate, notes } = req.body;
    const filePath = req.file ? `/uploads/${req.file.filename}` : null;
    
    const result = await pool.query(
      `INSERT INTO bills (project_id, bill_no, bill_date, description, amount, tax_amount, total_amount, vendor_name, invoice_no, invoice_date, submitted_by, submitted_date, file_path, notes, status, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'Pending', 'Unpaid') RETURNING *`,
      [projectId, billNo, billDate, description, amount, taxAmount, totalAmount, vendorName, invoiceNo, invoiceDate, submittedBy, submittedDate, filePath, notes]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/bills/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, approvedBy, paidBy } = req.body;
    
    const updateFields = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const values = [status];
    
    if (status === 'Approved') {
      updateFields.push('approved_by = $2', 'approved_date = CURRENT_TIMESTAMP');
      values.push(approvedBy || req.userName);
    } else if (status === 'Paid') {
      updateFields.push("payment_status = 'Paid'", 'paid_by = $2', 'paid_date = CURRENT_TIMESTAMP');
      values.push(paidBy || req.userName);
    }
    
    values.push(id);
    
    const result = await pool.query(
      `UPDATE bills SET ${updateFields.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk operations for bills
app.post('/api/bills/bulk', async (req, res) => {
  try {
    const { bills } = req.body;
    const results = [];
    for (const bill of bills) {
      const result = await pool.query(
        `INSERT INTO bills (project_id, bill_no, bill_date, description, amount, vendor_name, status, payment_status)
         VALUES ($1, $2, $3, $4, $5, $6, 'Pending', 'Unpaid') RETURNING *`,
        [bill.projectId, bill.billNo, bill.billDate, bill.description, bill.amount, bill.vendorName]
      );
      results.push(result.rows[0]);
    }
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bills/bulk-update', async (req, res) => {
  try {
    const { bills } = req.body;
    for (const bill of bills) {
      await pool.query(
        `UPDATE bills SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [bill.status, bill.id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// USERS
// ============================================

app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, user_code, name, email, role, department, is_active FROM users');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { userCode, name, email, password, role, department } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (user_code, name, email, password_hash, role, department, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id, user_code, name, email, role, department`,
      [userCode, name, email, passwordHash, role || 'USER', department]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'User already exists' });
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, department } = req.body;
    const result = await pool.query(
      `UPDATE users SET name = $1, email = $2, role = $3, department = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING id, user_code, name, email, role, department`,
      [name, email, role, department, id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// STOCK ITEMS (for Bill Tracker)
// ============================================

app.get('/api/stock-items', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM material_indents ORDER BY created_at DESC LIMIT 100');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/stock-items', async (req, res) => {
  try {
    const { itemCode, itemName, unit, category, currentStock, location } = req.body;
    const result = await pool.query(
      `INSERT INTO material_indents (item_code, item_description, unit, status)
       VALUES ($1, $2, $3, 'Stock') RETURNING *`,
      [itemCode, itemName, unit]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// SETTINGS & HEALTH
// ============================================

// Dashboard Stats Endpoint
app.get('/api/dashboard-stats', async (req, res) => {
  try {
    const [
      projectsCount,
      indentsPending,
      indentsApproved,
      posCount,
      grnCount,
      billsPending,
      billsApproved,
      billsPaid,
      vendorsCount,
      invoicesCount
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM projects'),
      pool.query("SELECT COUNT(*) as count FROM material_indents WHERE status = 'Pending'"),
      pool.query("SELECT COUNT(*) as count FROM material_indents WHERE status = 'Approved'"),
      pool.query('SELECT COUNT(*) as count FROM purchase_orders'),
      pool.query('SELECT COUNT(*) as count FROM grn'),
      pool.query("SELECT COUNT(*) as count FROM bills WHERE status = 'Pending'"),
      pool.query("SELECT COUNT(*) as count FROM bills WHERE status = 'Approved'"),
      pool.query("SELECT COUNT(*) as count FROM bills WHERE payment_status = 'Paid'"),
      pool.query('SELECT COUNT(*) as count FROM vendors WHERE is_active = true'),
      pool.query('SELECT COUNT(*) as count FROM invoices')
    ]);

    const poTotal = await pool.query('SELECT COALESCE(SUM(total), 0) as total FROM purchase_orders');
    const billsTotal = await pool.query('SELECT COALESCE(SUM(total_amount), 0) as total FROM bills');

    const recentIndents = await pool.query(
      'SELECT i.*, p.project_name FROM material_indents i LEFT JOIN projects p ON i.project_id = p.id ORDER BY i.created_at DESC LIMIT 5'
    );
    const recentBills = await pool.query(
      'SELECT b.*, p.project_name FROM bills b LEFT JOIN projects p ON b.project_id = p.id ORDER BY b.created_at DESC LIMIT 5'
    );

    res.json({
      success: true,
      data: {
        projects: parseInt(projectsCount.rows[0].count),
        indents: {
          pending: parseInt(indentsPending.rows[0].count),
          approved: parseInt(indentsApproved.rows[0].count)
        },
        purchaseOrders: parseInt(posCount.rows[0].count),
        grn: parseInt(grnCount.rows[0].count),
        bills: {
          pending: parseInt(billsPending.rows[0].count),
          approved: parseInt(billsApproved.rows[0].count),
          paid: parseInt(billsPaid.rows[0].count),
          totalAmount: parseFloat(billsTotal.rows[0].total)
        },
        vendors: parseInt(vendorsCount.rows[0].count),
        invoices: parseInt(invoicesCount.rows[0].count),
        totalPOValue: parseFloat(poTotal.rows[0].total),
        recentIndents: recentIndents.rows,
        recentBills: recentBills.rows
      }
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

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

app.put('/api/settings', async (req, res) => {
  try {
    const { key, value } = req.body;
    const result = await pool.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2 RETURNING *`,
      [key, value]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'BuildPro ERP API is running', timestamp: new Date().toISOString() });
});

// ============================================
// EMAIL NOTIFICATIONS
// ============================================

// Send notification email
app.post('/api/notify', async (req, res) => {
  try {
    const { to, type, data } = req.body;
    
    if (!to || !type) {
      return res.status(400).json({ error: 'Missing to or type parameter' });
    }
    
    const template = getEmailTemplate(type, data);
    if (!template) {
      return res.status(400).json({ error: 'Invalid notification type' });
    }
    
    const result = await sendEmail(to, template.subject, template.html);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send test email
app.post('/api/notify/test', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await sendEmail(
      email,
      'BuildPro ERP - Test Email',
      '<div style="font-family: Arial;"><h2>✅ Test Email</h2><p>Email notifications are working!</p></div>'
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// EXPORT REPORTS (CSV/Excel)
// ============================================

function arrayToCSV(data, headers) {
  if (!data || data.length === 0) return '';
  const headerRow = headers.map(h => `"${h.label}"`).join(',');
  const rows = data.map(row => {
    return headers.map(h => {
      const val = row[h.key];
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }).join(',');
  });
  return [headerRow, ...rows].join('\n');
}

app.get('/api/export/indents', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, p.project_name FROM material_indents i LEFT JOIN projects p ON i.project_id = p.id ORDER BY i.created_at DESC`
    );
    const headers = [
      { key: 'indent_number', label: 'Indent No' },
      { key: 'project_name', label: 'Project' },
      { key: 'item_description', label: 'Description' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'unit', label: 'Unit' },
      { key: 'status', label: 'Status' },
      { key: 'created_at', label: 'Created Date' }
    ];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=indents.csv');
    res.send(arrayToCSV(result.rows, headers));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/export/po', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT po.*, v.vendor_name, p.project_name FROM purchase_orders po 
       LEFT JOIN vendors v ON po.vendor_id = v.id 
       LEFT JOIN projects p ON po.project_id = p.id
       ORDER BY po.created_at DESC`
    );
    const headers = [
      { key: 'po_number', label: 'PO No' },
      { key: 'project_name', label: 'Project' },
      { key: 'vendor_name', label: 'Vendor' },
      { key: 'item_description', label: 'Description' },
      { key: 'quantity', label: 'Qty' },
      { key: 'rate', label: 'Rate' },
      { key: 'total', label: 'Total' },
      { key: 'status', label: 'Status' },
      { key: 'created_at', label: 'Date' }
    ];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=purchase_orders.csv');
    res.send(arrayToCSV(result.rows, headers));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/export/bills', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, p.project_name FROM bills b LEFT JOIN projects p ON b.project_id = p.id ORDER BY b.created_at DESC`
    );
    const headers = [
      { key: 'bill_no', label: 'Bill No' },
      { key: 'project_name', label: 'Project' },
      { key: 'vendor_name', label: 'Vendor' },
      { key: 'bill_date', label: 'Bill Date' },
      { key: 'description', label: 'Description' },
      { key: 'amount', label: 'Amount' },
      { key: 'tax_amount', label: 'Tax' },
      { key: 'total_amount', label: 'Total' },
      { key: 'status', label: 'Status' },
      { key: 'payment_status', label: 'Payment Status' }
    ];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=bills.csv');
    res.send(arrayToCSV(result.rows, headers));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/export/vendors', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vendors WHERE is_active = true ORDER BY vendor_name');
    const headers = [
      { key: 'vendor_code', label: 'Code' },
      { key: 'vendor_name', label: 'Name' },
      { key: 'contact_person', label: 'Contact' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'address', label: 'Address' }
    ];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=vendors.csv');
    res.send(arrayToCSV(result.rows, headers));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// DATABASE BACKUP/RESTORE
// ============================================

app.get('/api/backup/full', async (req, res) => {
  try {
    const tables = ['projects', 'vendors', 'users', 'material_indents', 'purchase_orders', 'grn', 'invoices', 'bills', 'material_tracker_items', 'settings'];
    const backup = {};
    
    for (const table of tables) {
      const result = await pool.query(`SELECT * FROM ${table}`);
      backup[table] = result.rows;
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=buildpro_backup.json');
    res.json(backup);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/backup/restore', async (req, res) => {
  try {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: 'No data provided' });
    
    const tableOrder = ['projects', 'vendors', 'users', 'material_indents', 'purchase_orders', 'grn', 'invoices', 'bills', 'material_tracker_items', 'settings'];
    
    for (const table of tableOrder) {
      if (data[table] && Array.isArray(data[table])) {
        // Clear existing data
        await pool.query(`DELETE FROM ${table}`);
        // Restore data
        for (const row of data[table]) {
          const columns = Object.keys(row).filter(k => row[k] !== undefined);
          const values = columns.map((_, i) => `$${i + 1}`);
          const cols = columns.join(', ');
          await pool.query(
            `INSERT INTO ${table} (${cols}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING`,
            columns.map(c => row[c])
          );
        }
      }
    }
    
    res.json({ success: true, message: 'Database restored successfully' });
  } catch (err) {
    console.error('Restore error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// STATIC FILES
// ============================================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle other HTML files
app.get('/:page', (req, res) => {
  const page = req.params.page;
  if (page.endsWith('.html') || page === 'vendors') {
    res.sendFile(path.join(__dirname, 'public', page + (page.endsWith('.html') ? '' : '.html')));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(50));
  console.log('🚀 BuildPro ERP Server running on http://localhost:3000');
  console.log('📊 Combined: Procurement + Bill Tracker');
  console.log('🗄️  Database: PostgreSQL');
  console.log('='.repeat(50));
});

module.exports = app;