-- ============================================
-- QS (Quantity Surveyor) MODULE
-- ============================================

-- QS Certifications table
CREATE TABLE IF NOT EXISTS qs_certifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id),
    indent_id UUID REFERENCES material_indents(id),
    po_id UUID REFERENCES purchase_orders(id),
    qs_cert_number VARCHAR(50) UNIQUE,
    certification_date DATE,
    certified_quantity DECIMAL(12,2),
    certified_amount DECIMAL(12,2),
    certified_by VARCHAR(100),
    qs_remarks TEXT,
    status VARCHAR(50) DEFAULT 'Pending', -- Pending, Certified, Rejected
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- QS Measurements / Rate Analysis
CREATE TABLE IF NOT EXISTS qs_measurements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id),
    item_description TEXT,
    unit VARCHAR(20),
    agreed_rate DECIMAL(12,2),
    market_rate DECIMAL(12,2),
    variance DECIMAL(5,2),
    qs_notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- QS Bills / Work Orders
CREATE TABLE IF NOT EXISTS qs_work_bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id),
    bill_number VARCHAR(50) UNIQUE,
    bill_date DATE,
    contractor_name VARCHAR(200),
    work_description TEXT,
    gross_amount DECIMAL(12,2),
    deduction_amount DECIMAL(12,2),
    net_amount DECIMAL(12,2),
    retention_percentage DECIMAL(5,2),
    retention_amount DECIMAL(12,2),
    status VARCHAR(50) DEFAULT 'Pending',
    certified_by VARCHAR(100),
    certified_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- QA/QC (Quality Assurance/Quality Control) MODULE
-- ============================================

-- QA/QC Inspections
CREATE TABLE IF NOT EXISTS qa_inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id),
    inspection_number VARCHAR(50) UNIQUE,
    inspection_date DATE,
    inspection_type VARCHAR(50), -- Pre-work, During-work, Post-work
    location VARCHAR(200),
    work_category VARCHAR(100),
    inspector_name VARCHAR(100),
    checklist_items JSONB,
    findings TEXT,
    severity VARCHAR(20), -- Minor, Major, Critical
    status VARCHAR(50) DEFAULT 'Pending',
    follow_up_required BOOLEAN DEFAULT false,
    follow_up_date DATE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- QA/QC Non-Conformance Reports (NCR)
CREATE TABLE IF NOT EXISTS qa_ncr (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id),
    ncr_number VARCHAR(50) UNIQUE,
    ncr_date DATE,
    description TEXT,
    root_cause TEXT,
    corrective_action TEXT,
    preventive_action TEXT,
    responsible_person VARCHAR(100),
    target_date DATE,
    closure_date DATE,
    status VARCHAR(50) DEFAULT 'Open', -- Open, In Progress, Closed
    severity VARCHAR(20), -- Minor, Major, Critical
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- QA/QC Test Reports
CREATE TABLE IF NOT EXISTS qa_test_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id),
    test_report_number VARCHAR(50) UNIQUE,
    test_date DATE,
    test_type VARCHAR(100), -- Concrete, Soil, Steel, Water, etc.
    sample_id VARCHAR(50),
    test_results JSONB,
    test_conclusion VARCHAR(20), -- Pass, Fail, Conditional
    tested_by VARCHAR(100),
    witnessed_by VARCHAR(100),
    lab_name VARCHAR(200),
    report_file_path VARCHAR(500),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- QA/QC Checklists
CREATE TABLE IF NOT EXISTS qa_checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id),
    checklist_name VARCHAR(200),
    category VARCHAR(100), -- Structural, Electrical, Plumbing, Safety
    items JSONB, -- Array of checklist items with yes/no/na
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Material Test Results
CREATE TABLE IF NOT EXISTS qa_material_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id),
    material_name VARCHAR(200),
    supplier_name VARCHAR(200),
    batch_number VARCHAR(50),
    test_date DATE,
    test_results JSONB,
    result VARCHAR(20), -- Pass, Fail
    lab_report_number VARCHAR(50),
    remarks TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES FOR QS & QA/QC
-- ============================================

CREATE INDEX idx_qs_cert_project ON qs_certifications(project_id);
CREATE INDEX idx_qs_cert_status ON qs_certifications(status);
CREATE INDEX idx_qs_bills_project ON qs_work_bills(project_id);
CREATE INDEX idx_qa_inspections_project ON qa_inspections(project_id);
CREATE INDEX idx_qa_ncr_project ON qa_ncr(project_id);
CREATE INDEX idx_qa_test_reports_project ON qa_test_reports(project_id);
CREATE INDEX idx_qa_material_tests_project ON qa_material_tests(project_id);