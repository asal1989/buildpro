-- ============================================
-- BuildPro + TQS ERP - Merged PostgreSQL Schema
-- Combined Procurement + Bill Tracker Application
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROJECTS (Must be created first due to foreign keys)
-- ============================================

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_code VARCHAR(100) UNIQUE NOT NULL,
    project_name VARCHAR(255) NOT NULL,
    client_name VARCHAR(255),
    location VARCHAR(255),
    start_date DATE,
    end_date DATE,
    budget DECIMAL(15,2),
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'USER',
    department VARCHAR(100),
    project_id UUID REFERENCES projects(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Session management
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PROCUREMENT MODULE - VENDORS
-- ============================================

CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_code VARCHAR(50) UNIQUE NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    tax_number VARCHAR(100),
    bank_details TEXT,
    rating INTEGER DEFAULT 3,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PROCUREMENT MODULE - MATERIAL INDENTS
-- ============================================

CREATE TABLE material_indents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    indent_number VARCHAR(50) UNIQUE NOT NULL,
    project_id UUID REFERENCES projects(id),
    department VARCHAR(100),
    requested_by VARCHAR(255),
    request_date DATE NOT NULL,
    required_date DATE,
    status VARCHAR(50) DEFAULT 'Pending',
    item_description TEXT NOT NULL,
    item_code VARCHAR(100),
    unit VARCHAR(20),
    quantity DECIMAL(15,3) NOT NULL,
    approved_quantity DECIMAL(15,3),
    estimated_rate DECIMAL(15,2),
    estimated_amount DECIMAL(15,2),
    approved_by VARCHAR(255),
    approved_on TIMESTAMP,
    rejected_by VARCHAR(255),
    rejected_on TIMESTAMP,
    reject_reason TEXT,
    po_raised_on TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PROCUREMENT MODULE - QUOTATIONS
-- ============================================

CREATE TABLE quotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_number VARCHAR(50) UNIQUE NOT NULL,
    indent_id UUID REFERENCES material_indents(id),
    vendor_id UUID REFERENCES vendors(id),
    quotation_date DATE NOT NULL,
    valid_until DATE,
    status VARCHAR(50) DEFAULT 'Pending',
    item_description TEXT,
    quantity DECIMAL(15,3),
    rate DECIMAL(15,2),
    total_amount DECIMAL(15,2),
    discount_percent DECIMAL(5,2),
    discount_amount DECIMAL(15,2),
    tax_percent DECIMAL(5,2),
    tax_amount DECIMAL(15,2),
    grand_total DECIMAL(15,2),
    terms TEXT,
    delivery_days INTEGER,
    payment_terms VARCHAR(255),
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PROCUREMENT MODULE - PURCHASE ORDERS
-- ============================================

CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_number VARCHAR(50) UNIQUE NOT NULL,
    indent_id UUID REFERENCES material_indents(id),
    vendor_id UUID REFERENCES vendors(id),
    po_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    item_description TEXT,
    material VARCHAR(255),
    quantity DECIMAL(15,3),
    unit VARCHAR(20),
    rate DECIMAL(15,2),
    total DECIMAL(15,2),
    delivery_days INTEGER,
    payment_terms VARCHAR(255),
    notes TEXT,
    sent_at TIMESTAMP,
    received_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PROCUREMENT MODULE - INVOICES
-- ============================================

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    po_id UUID REFERENCES purchase_orders(id),
    vendor_id UUID REFERENCES vendors(id),
    invoice_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    amount DECIMAL(15,2),
    tax_amount DECIMAL(15,2),
    total_amount DECIMAL(15,2),
    description TEXT,
    due_date DATE,
    paid_at TIMESTAMP,
    approved_at TIMESTAMP,
    hold_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PROCUREMENT MODULE - GRN (Goods Received Note)
-- ============================================

CREATE TABLE grn (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grn_number VARCHAR(50) UNIQUE NOT NULL,
    po_id UUID REFERENCES purchase_orders(id),
    vendor_id UUID REFERENCES vendors(id),
    received_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    item_description TEXT,
    quantity_received DECIMAL(15,3),
    quantity_accepted DECIMAL(15,3),
    quantity_rejected DECIMAL(15,3),
    unit VARCHAR(20),
    rate DECIMAL(15,2),
    total DECIMAL(15,2),
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PROCUREMENT MODULE - QS CERTIFICATIONS
-- ============================================

CREATE TABLE qs_certifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certification_number VARCHAR(50) UNIQUE NOT NULL,
    po_id UUID REFERENCES purchase_orders(id),
    grn_id UUID REFERENCES grn(id),
    cert_date DATE,
    status VARCHAR(50) DEFAULT 'Pending',
    quantity_certified DECIMAL(15,3),
    rate DECIMAL(15,2),
    amount DECIMAL(15,2),
    remarks TEXT,
    certified_at TIMESTAMP,
    rework_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- BILL TRACKER MODULE - MATERIAL TRACKER
-- ============================================

CREATE TABLE material_tracker_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracker_no VARCHAR(50) UNIQUE NOT NULL,
    project_id UUID REFERENCES projects(id),
    
    -- Basic Info
    team_name VARCHAR(255),
    head_name VARCHAR(255),
    responsibility VARCHAR(255),
    workflow_status VARCHAR(50) DEFAULT 'Draft',
    
    -- MR Details
    item_code VARCHAR(100),
    item_description TEXT,
    unit VARCHAR(20),
    mr_no VARCHAR(50),
    mr_date DATE,
    pm_cert_date DATE,
    qs_cert_date DATE,
    material_required_date DATE,
    mr_qty DECIMAL(15,3),
    material_receipt_date_site DATE,
    
    -- PO Details
    vendor_name VARCHAR(255),
    po_no VARCHAR(50),
    po_date DATE,
    ordered_qty DECIMAL(15,3),
    unit_price DECIMAL(15,2),
    procurement_days INTEGER,
    po_gst_pct DECIMAL(5,2),
    po_value_basic DECIMAL(15,2),
    po_value_with_tax DECIMAL(15,2),
    
    -- Invoice Details
    invoice_number VARCHAR(50),
    invoice_date DATE,
    invoice_qty DECIMAL(15,3),
    material_received_qty DECIMAL(15,3),
    balance_qty_to_be_supplied DECIMAL(15,3),
    invoice_sent_to_ho_date DATE,
    
    -- QS Certification
    qs_remarks TEXT,
    certified_qty DECIMAL(15,3),
    qty_certified_by_qs DECIMAL(15,3),
    rate DECIMAL(15,2),
    basic_amount DECIMAL(15,2),
    amount_certified_by_qs_for_payment DECIMAL(15,2),
    total_amount_certified_by_qs DECIMAL(15,2),
    advance_certified_by_qs_finance BOOLEAN,
    
    -- Accounts
    invoice_received_by_ho DATE,
    taxes_percent DECIMAL(5,2),
    cgst DECIMAL(15,2),
    sgst DECIMAL(15,2),
    igst DECIMAL(15,2),
    mob_advance_deduction DECIMAL(15,2),
    tds_other_deduction DECIMAL(15,2),
    retention DECIMAL(15,2),
    certified_invoice_handed_to_accounts DATE,
    remarks TEXT,
    
    -- Advance
    advance_voucher_handover DATE,
    recommended_advance_amount DECIMAL(15,2),
    advance_certified_by_qs_project BOOLEAN,
    advance_qs_ho_date DATE,
    adv_accounts_receipt_date DATE,
    adv_payment_date DATE,
    cheque_amount DECIMAL(15,2),
    cheque_date DATE,
    vendor_cheque_collect VARCHAR(255),
    
    stores_remarks TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- BILL TRACKER MODULE - BILLS
-- ============================================

CREATE TABLE bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sl_no VARCHAR(50) UNIQUE NOT NULL,
    project_id UUID REFERENCES projects(id),
    
    bill_no VARCHAR(100),
    bill_date DATE,
    description TEXT,
    amount DECIMAL(15,2),
    tax_amount DECIMAL(15,2),
    total_amount DECIMAL(15,2),
    
    vendor_name VARCHAR(255),
    invoice_no VARCHAR(100),
    invoice_date DATE,
    
    status VARCHAR(50) DEFAULT 'Pending',
    payment_status VARCHAR(50) DEFAULT 'Unpaid',
    
    submitted_by VARCHAR(255),
    submitted_date DATE,
    approved_by VARCHAR(255),
    approved_date DATE,
    paid_by VARCHAR(255),
    paid_date DATE,
    
    file_path VARCHAR(500),
    
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- SETTINGS
-- ============================================

CREATE TABLE settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- AUDIT LOG
-- ============================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_projects_code ON projects(project_code);
CREATE INDEX idx_material_indents_status ON material_indents(status);
CREATE INDEX idx_material_indents_project ON material_indents(project_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_vendors_code ON vendors(vendor_code);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_bills_project ON bills(project_id);
CREATE INDEX idx_bills_status ON bills(status);
CREATE INDEX idx_material_tracker_project ON material_tracker_items(project_id);
CREATE INDEX idx_material_tracker_status ON material_tracker_items(workflow_status);

-- ============================================
-- SEED DATA
-- ============================================

-- Default Admin User (password: admin123)
INSERT INTO users (user_code, name, email, password_hash, role, department) 
VALUES ('ADMIN', 'Administrator', 'admin@company.local', 'scrypt$16$a1b2c3d4e5f6g7h8$i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2', 'ADMIN', 'Admin')
ON CONFLICT (user_code) DO NOTHING;

-- Sample Projects
INSERT INTO projects (project_code, project_name, client_name, location, status) 
VALUES 
    ('PRJ-001', 'Building Construction Project', 'ABC Corp', 'Mumbai', 'Active'),
    ('PRJ-002', 'Road Infrastructure', 'Govt Department', 'Delhi', 'Active')
ON CONFLICT (project_code) DO NOTHING;

-- Sample Settings
INSERT INTO settings (key, value) VALUES 
    ('company_name', 'BuildPro Engineering'),
    ('company_logo', ''),
    ('tqs_sync_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- FUNCTIONS FOR AUTO-GENERATING IDs
-- ============================================

-- Function to generate indent numbers
CREATE OR REPLACE FUNCTION generate_indent_number()
RETURNS TRIGGER AS $$
DECLARE
    prefix TEXT;
    next_num INTEGER;
BEGIN
    prefix := 'IND-' || TO_CHAR(CURRENT_DATE, 'YYMMDD') || '-';
    SELECT COALESCE(MAX(CAST(SUBSTRING(indent_number FROM prefix || '....') AS INTEGER)), 0) + 1
    INTO next_num
    FROM material_indents
    WHERE indent_number LIKE prefix || '%';
    NEW.indent_number := prefix || LPAD(next_num::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_indent_number_trigger
    BEFORE INSERT ON material_indents
    FOR EACH ROW
    WHEN (NEW.indent_number IS NULL)
    EXECUTE FUNCTION generate_indent_number();

-- Function to generate PO numbers
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TRIGGER AS $$
DECLARE
    prefix TEXT;
    next_num INTEGER;
BEGIN
    prefix := 'PO-' || TO_CHAR(CURRENT_DATE, 'YYMMDD') || '-';
    SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM prefix || '....') AS INTEGER)), 0) + 1
    INTO next_num
    FROM purchase_orders
    WHERE po_number LIKE prefix || '%';
    NEW.po_number := prefix || LPAD(next_num::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_po_number_trigger
    BEFORE INSERT ON purchase_orders
    FOR EACH ROW
    WHEN (NEW.po_number IS NULL)
    EXECUTE FUNCTION generate_po_number();

-- Function to generate tracker numbers
CREATE OR REPLACE FUNCTION generate_tracker_number()
RETURNS TRIGGER AS $$
DECLARE
    next_num INTEGER;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(tracker_no FROM 'MT-....') AS INTEGER)), 0) + 1
    INTO next_num
    FROM material_tracker_items;
    NEW.tracker_no := 'MT-' || LPAD(next_num::TEXT, 5, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_tracker_number_trigger
    BEFORE INSERT ON material_tracker_items
    FOR EACH ROW
    WHEN (NEW.tracker_no IS NULL)
    EXECUTE FUNCTION generate_tracker_number();

-- Function to generate SL numbers for bills
CREATE OR REPLACE FUNCTION generate_sl_number()
RETURNS TRIGGER AS $$
DECLARE
    year_str TEXT;
    next_num INTEGER;
BEGIN
    year_str := TO_CHAR(CURRENT_DATE, 'YY');
    SELECT COALESCE(MAX(CAST(SUBSTRING(sl_no FROM year_str || '....') AS INTEGER)), 0) + 1
    INTO next_num
    FROM bills
    WHERE sl_no LIKE year_str || '%';
    NEW.sl_no := year_str || LPAD(next_num::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_sl_number_trigger
    BEFORE INSERT ON bills
    FOR EACH ROW
    WHEN (NEW.sl_no IS NULL)
    EXECUTE FUNCTION generate_sl_number();