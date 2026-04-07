// ============================================
// BuildPro + TQS ERP - Merged Server
// Combined Procurement + Bill Tracker Application
// ============================================

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// DATABASE CONFIGURATION
// ============================================

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'buildpro_erp',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// Test database connection
pool.query('SELECT NOW()')
  .then(() => console.log('✅ Connected to PostgreSQL database'))
  .catch(err => console.error('❌ Database connection error:', err.message));

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// File upload configuration
const uploadDir = path.join(__dirname, 'uploads');
const multerConfig = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// ============================================
// AUTHENTICATION
// ============================================

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const sessions = new Map(); // token -> { userId, userName, role, dept, expiresAt }

// Password hashing
async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// Session management
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createSession(user) {
  const token = generateToken();
  sessions.set(token, {
    userId: user.id,
    userName: user.name,
    role: user.role,
    dept: user.department,
    projectId: user.project_id,
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  return token;
}

function getSession(token) {
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (session) sessions.delete(token);
    return null;
  }
  return session;
}

// Auth middleware for API routes
function requireAuth(req, res, next) {
  const publicPaths = ['/api/auth/login', '/api/auth/register', '/api/health', '/api/settings'];
  if (publicPaths.includes(req.path)) return next();

  const token = req.headers['x-auth-token'];
  const session = getSession(token);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  req.user = session;
  next();
}

app.use('/api', requireAuth);

// ============================================
// API ROUTES - AUTH
// ============================================

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { userCode, password } = req.body;
    
    const result = await pool.query(
      'SELECT * FROM users WHERE user_code = $1 AND is_active = true',
      [userCode]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const valid = await verifyPassword(password, user.password_hash);
    
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    const token = createSession(user);
    
    res.json({
      success: true,
      data: {
        token,
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
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (token) sessions.delete(token);
  res.json({ success: true });
});

// Get current user
app.get('/api/auth/me', (req, res) => {
  const token = req.headers['x-auth-token'];
  const session = getSession(token);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  res.json({ success: true, data: session });
});

// Register (admin only)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { userCode, name, email, password, role, department, projectId } = req.body;
    
    const passwordHash = await hashPassword(password);
    
    const result = await pool.query(
      `INSERT INTO users (user_code, name, email, password_hash, role, department, project_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_code, name, email, role, department`,
      [userCode, name, email, passwordHash, role || 'USER', department, projectId]
    );
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ success: false, error: 'User code or email already exists' });
    }
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============================================
// API ROUTES - PROJECTS
// ============================================

// Get all projects
app.get('/api/projects', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Create project
app.post('/api/projects', async (req, res) => {
  try {
    const { projectCode, projectName, clientName, location, startDate, endDate, budget, status } = req.body;
    
    const result = await pool.query(
      `INSERT INTO projects (project_code, project_name, client_name, location, start_date, end_date, budget, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [projectCode, projectName, clientName, location, startDate, endDate, budget, status || 'Active']
    );
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============================================
// API ROUTES - VENDORS (Procurement)
// ============================================

// Get all vendors
app.get('/api/vendors', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vendors WHERE is_active = true ORDER BY vendor_name');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching vendors:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Create vendor
app.post('/api/vendors', async (req, res) => {
  try {
    const { vendorCode, vendorName, contactPerson, email, phone, address, taxNumber, bankDetails, rating } = req.body;
    
    const result = await pool.query(
      `INSERT INTO vendors (vendor_code, vendor_name, contact_person, email, phone, address, tax_number, bank_details, rating)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [vendorCode, vendorName, contactPerson, email, phone, address, taxNumber, bankDetails, rating || 3]
    );
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error creating vendor:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Update vendor
app.put('/api/vendors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { vendorName, contactPerson, email, phone, address, taxNumber, bankDetails, rating } = req.body;
    
    const result = await pool.query(
      `UPDATE vendors SET vendor_name = $1, contact_person = $2, email = $3, phone = $4, address = $5,
       tax_number = $6, bank_details = $7, rating = $8, updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [vendorName, contactPerson, email, phone, address, taxNumber, bankDetails, rating, id]
    );
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error updating vendor:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============================================
// API ROUTES - MATERIAL INDENTS (Procurement)
// ============================================

// Get all indents
app.get('/api/indents', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, p.project_name 
       FROM material_indents i 
       LEFT JOIN projects p ON i.project_id = p.id
       ORDER BY i.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching indents:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Create indent
app.post('/api/indents', async (req, res) => {
  try {
    const { projectId, department, requestedBy, requestDate, requiredDate, itemDescription, itemCode, unit, quantity, estimatedRate, estimatedAmount, notes } = req.body;
    
    const result = await pool.query(
      `INSERT INTO material_indents (project_id, department, requested_by, request_date, required_date, 
       item_description, item_code, unit, quantity, estimated_rate, estimated_amount, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Pending')
       RETURNING *`,
      [projectId, department, requestedBy, requestDate, requiredDate, itemDescription, itemCode, unit, quantity, estimatedRate, estimatedAmount, notes]
    );
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error creating indent:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Update indent status
app.patch('/api/indents/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, actor, reason, approvedQty } = req.body;
    
    const updateFields = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const values = [status];
    let paramIndex = 2;
    
    if (status === 'Approved') {
      updateFields.push(`approved_by = $${paramIndex++}`);
      values.push(actor || 'Administrator');
      updateFields.push(`approved_on = CURRENT_TIMESTAMP`);
      if (approvedQty) {
        updateFields.push(`approved_quantity = $${paramIndex++}`);
        values.push(approvedQty);
      }
    } else if (status === 'Rejected') {
      updateFields.push(`rejected_by = $${paramIndex++}`);
      values.push(actor || 'Administrator');
      updateFields.push(`rejected_on = CURRENT_TIMESTAMP`);
      updateFields.push(`reject_reason = $${paramIndex++}`);
      values.push(reason || 'Rejected');
    } else if (status === 'PO Raised') {
      updateFields.push(`po_raised_on = CURRENT_TIMESTAMP`);
    }
    
    values.push(id);
    
    const result = await pool.query(
      `UPDATE material_indents SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error updating indent status:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============================================
// API ROUTES - PURCHASE ORDERS (Procurement)
// ============================================

// Get all POs
app.get('/api/pos', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT po.*, v.vendor_name, i.indent_number
       FROM purchase_orders po
       LEFT JOIN vendors v ON po.vendor_id = v.id
       LEFT JOIN material_indents i ON po.indent_id = i.id
       ORDER BY po.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching POs:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Create PO
app.post('/api/pos', async (req, res) => {
  try {
    const { indentId, vendorId, poDate, itemDescription, material, quantity, unit, rate, total, deliveryDays, paymentTerms, notes } = req.body;
    
    const result = await pool.query(
      `INSERT INTO purchase_orders (indent_id, vendor_id, po_date, item_description, material, quantity, unit, rate, total, delivery_days, payment_terms, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Issued')
       RETURNING *`,
      [indentId, vendorId, poDate, itemDescription, material, quantity, unit, rate, total, deliveryDays, paymentTerms, notes]
    );
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error creating PO:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Update PO status
app.patch('/api/pos/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const updateFields = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const values = [status];
    
    if (status === 'Sent') {
      updateFields.push('sent_at = CURRENT_TIMESTAMP');
    } else if (status === 'Received' || status === 'Partially Received') {
      updateFields.push('received_at = CURRENT_TIMESTAMP');
    } else if (status === 'Cancelled') {
      updateFields.push('cancelled_at = CURRENT_TIMESTAMP');
    }
    
    values.push(id);
    
    const result = await pool.query(
      `UPDATE purchase_orders SET ${updateFields.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error updating PO status:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============================================
// API ROUTES - INVOICES (Procurement)
// ============================================

// Get all invoices
app.get('/api/invoices', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT inv.*, v.vendor_name, po.po_number
       FROM invoices inv
       LEFT JOIN vendors v ON inv.vendor_id = v.id
       LEFT JOIN purchase_orders po ON inv.po_id = po.id
       ORDER BY inv.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching invoices:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Create invoice
app.post('/api/invoices', async (req, res) => {
  try {
    const { poId, vendorId, invoiceDate, amount, taxAmount, totalAmount, description, dueDate, invoiceNumber } = req.body;
    
    const result = await pool.query(
      `INSERT INTO invoices (po_id, vendor_id, invoice_date, amount, tax_amount, total_amount, description, due_date, invoice_number, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Pending')
       RETURNING *`,
      [poId, vendorId, invoiceDate, amount, taxAmount, totalAmount, description, dueDate, invoiceNumber]
    );
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error creating invoice:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Update invoice status
app.patch('/api/invoices/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const updateFields = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    
    if (status === 'Approved') {
      updateFields.push('approved_at = CURRENT_TIMESTAMP');
    } else if (status === 'Paid') {
      updateFields.push('paid_at = CURRENT_TIMESTAMP');
    } else if (status === 'On Hold') {
      updateFields.push('hold_at = CURRENT_TIMESTAMP');
    }
    
    const result = await pool.query(
      `UPDATE invoices SET ${updateFields.join(', ')} WHERE id = $1 RETURNING *`,
      [status, id]
    );
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error updating invoice status:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============================================
// API ROUTES - GRN (Procurement)
// ============================================

// Get all GRNs
app.get('/api/grn', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT g.*, v.vendor_name, po.po_number
       FROM grn g
       LEFT JOIN vendors v ON g.vendor_id = v.id
       LEFT JOIN purchase_orders po ON g.po_id = po.id
       ORDER BY g.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching GRNs:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Create GRN
app.post('/api/grn', async (req, res) => {
  try {
    const { poId, vendorId, receivedDate, itemDescription, quantityReceived, quantityAccepted, quantityRejected, unit, rate, total, remarks } = req.body;
    
    const result = await pool.query(
      `INSERT INTO grn (po_id, vendor_id, received_date, item_description, quantity_received, quantity_accepted, quantity_rejected, unit, rate, total, remarks, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Received')
       RETURNING *`,
      [poId, vendorId, receivedDate, itemDescription, quantityReceived, quantityAccepted, quantityRejected, unit, rate, total, remarks]
    );
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error creating GRN:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============================================
// API ROUTES - QS CERTIFICATIONS (Procurement)
// ============================================

// Get all QS certifications
app.get('/api/qs-certifications', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT qs.*, po.po_number, g.grn_number
       FROM qs_certifications qs
       LEFT JOIN purchase_orders po ON qs.po_id = po.id
       LEFT JOIN grn g ON qs.grn_id = g.id
       ORDER BY qs.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching QS certifications:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Create QS certification
app.post('/api/qs-certifications', async (req, res) => {
  try {
    const { poId, grnId, certDate, quantityCertified, rate, amount, remarks } = req.body;
    
    const result = await pool.query(
      `INSERT INTO qs_certifications (po_id, grn_id, cert_date, quantity_certified, rate, amount, remarks, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Certified')
       RETURNING *`,
      [poId, grnId, certDate, quantityCertified, rate, amount, remarks]
    );
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error creating QS certification:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============================================
// API ROUTES - QUOTATIONS (Procurement)
// ============================================

// Get all quotations
app.get('/api/quotations', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT q.*, v.vendor_name, i.indent_number
       FROM quotations q
       LEFT JOIN vendors v ON q.vendor_id = v.id
       LEFT JOIN material_indents i ON q.indent_id = i.id
       ORDER BY q.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching quotations:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Create quotation
app.post('/api/quotations', async (req, res) => {
  try {
    const { indentId, vendorId, quotationDate, validUntil, itemDescription, quantity, rate, totalAmount, discountPercent, discountAmount, taxPercent, taxAmount, grandTotal, terms, deliveryDays, paymentTerms, remarks } = req.body;
    
    const result = await pool.query(
      `INSERT INTO quotations (indent_id, vendor_id, quotation_date, valid_until, item_description, quantity, rate, total_amount, discount_percent, discount_amount, tax_percent, tax_amount, grand_total, terms, delivery_days, payment_terms, remarks, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'Pending')
       RETURNING *`,
      [indentId, vendorId, quotationDate, validUntil, itemDescription, quantity, rate, totalAmount, discountPercent, discountAmount, taxPercent, taxAmount, grandTotal, terms, deliveryDays, paymentTerms, remarks]
    );
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error creating quotation:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============================================
// API ROUTES - MATERIAL TRACKER (Bill Tracker)
// ============================================

// Get all tracker items
app.get('/api/material-tracker', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT mt.*, p.project_name
       FROM material_tracker_items mt
       LEFT JOIN projects p ON mt.project_id = p.id
       ORDER BY mt.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching material tracker:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Create/update material tracker item
app.post('/api/material-tracker', async (req, res) => {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
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
      'advance_certified_by_qs_finance', 'invoice_received_by_ho', 'taxes_percent',
      'cgst', 'sgst', 'igst', 'mob_advance_deduction', 'tds_other_deduction',
      'retention', 'certified_invoice_handed_to_accounts', 'remarks',
      'advance_voucher_handover', 'recommended_advance_amount', 'advance_certified_by_qs_project',
      'advance_qs_ho_date', 'adv_accounts_receipt_date', 'adv_payment_date',
      'cheque_amount', 'cheque_date', 'vendor_cheque_collect', 'stores_remarks',
      'workflow_status'
    ];
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        fields.push(`${field} = $${paramIndex++}`);
        values.push(req.body[field]);
      }
    }
    
    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields provided' });
    }
    
    const result = await pool.query(
      `INSERT INTO material_tracker_items (${fields.join(', ')})
       VALUES (${values.map((_, i) => `$${i + 1}`).join(', ')})
       RETURNING *`,
      values
    );
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error creating material tracker:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Update material tracker
app.put('/api/material-tracker/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
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
      'advance_certified_by_qs_finance', 'invoice_received_by_ho', 'taxes_percent',
      'cgst', 'sgst', 'igst', 'mob_advance_deduction', 'tds_other_deduction',
      'retention', 'certified_invoice_handed_to_accounts', 'remarks',
      'advance_voucher_handover', 'recommended_advance_amount', 'advance_certified_by_qs_project',
      'advance_qs_ho_date', 'adv_accounts_receipt_date', 'adv_payment_date',
      'cheque_amount', 'cheque_date', 'vendor_cheque_collect', 'stores_remarks',
      'workflow_status'
    ];
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        fields.push(`${field} = $${paramIndex++}`);
        values.push(req.body[field]);
      }
    }
    
    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields provided' });
    }
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    const result = await pool.query(
      `UPDATE material_tracker_items SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error updating material tracker:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============================================
// API ROUTES - BILLS (Bill Tracker)
// ============================================

// Get all bills
app.get('/api/bills', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, p.project_name
       FROM bills b
       LEFT JOIN projects p ON b.project_id = p.id
       ORDER BY b.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching bills:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Create bill
app.post('/api/bills', multerConfig.single('file'), async (req, res) => {
  try {
    const { projectId, billNo, billDate, description, amount, taxAmount, totalAmount, vendorName, invoiceNo, invoiceDate, submittedBy, submittedDate, notes } = req.body;
    
    const filePath = req.file ? `/uploads/${req.file.filename}` : null;
    
    const result = await pool.query(
      `INSERT INTO bills (project_id, bill_no, bill_date, description, amount, tax_amount, total_amount, vendor_name, invoice_no, invoice_date, submitted_by, submitted_date, file_path, notes, status, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'Pending', 'Unpaid')
       RETURNING *`,
      [projectId, billNo, billDate, description, amount, taxAmount, totalAmount, vendorName, invoiceNo, invoiceDate, submittedBy, submittedDate, filePath, notes]
    );
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error creating bill:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Update bill status
app.patch('/api/bills/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, approvedBy, paidBy } = req.body;
    
    const updateFields = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const values = [status];
    
    if (status === 'Approved') {
      updateFields.push(`approved_by = $2`);
      updateFields.push(`approved_date = CURRENT_TIMESTAMP`);
      values.push(approvedBy || req.user.userName);
    } else if (status === 'Paid') {
      updateFields.push(`payment_status = 'Paid'`);
      updateFields.push(`paid_by = $2`);
      updateFields.push(`paid_date = CURRENT_TIMESTAMP`);
      values.push(paidBy || req.user.userName);
    }
    
    values.push(id);
    
    const result = await pool.query(
      `UPDATE bills SET ${updateFields.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error updating bill status:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============================================
// API ROUTES - SETTINGS
// ============================================

// Get settings
app.get('/api/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM settings');
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json({ success: true, data: settings });
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Update setting
app.put('/api/settings', async (req, res) => {
  try {
    const { key, value } = req.body;
    
    const result = await pool.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [key, value]
    );
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error updating setting:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============================================
// API ROUTES - HEALTH CHECK
// ============================================

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'BuildPro ERP API is running', timestamp: new Date().toISOString() });
});

// ============================================
// STATIC FILES & FALLBACK
// ============================================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 BuildPro ERP Server running on http://0.0.0.0:${PORT}`);
  console.log(`📊 Combined: Procurement Module + Bill Tracker`);
  console.log(`🗄️  Database: PostgreSQL`);
});

module.exports = app;