# BuildPro ERP - Merged Application

Combined **Procurement Module** (from `proc/`) and **Bill Tracker** (from `final01042026/`) into a single unified application with **PostgreSQL** database.

## Features

### Procurement Module
- 🔹 Material Indents management
- 🔹 Purchase Orders (PO) creation & tracking
- 🔹 Vendor management
- 🔹 Invoices & Payments
- 🔹 GRN (Goods Received Note)
- 🔹 QS Certifications
- 🔹 Quotations

### Bill Tracker Module
- 📑 Bill submission & tracking
- 📑 Material Tracker for Store/QS/Accounts workflow
- 📑 Payment status management
- 📑 Bill approval workflow

## Tech Stack
- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Frontend**: HTML + JavaScript (SPA-style)
- **Authentication**: JWT tokens with bcrypt

## Prerequisites

1. **Node.js** (v18+) - [Download](https://nodejs.org)
2. **PostgreSQL** (v14+) - [Download](https://www.postgresql.org/download/)

## Setup Steps

### 1. Database Setup

Create the PostgreSQL database and run the schema:

```bash
# Create database
createdb buildpro_erp

# Run the schema
psql -d buildpro_erp -f schema.sql
```

Or use any PostgreSQL client (pgAdmin, DBeaver, etc.) to:
1. Create a database named `buildpro_erp`
2. Run the contents of `schema.sql`

### 2. Environment Configuration

```bash
# Copy the example env file
cp .env.example .env

# Edit .env with your database credentials
```

### 3. Install Dependencies

```bash
cd merged-app
npm install
```

### 4. Start the Server

```bash
npm start
```

The server will start on `http://localhost:3000`

### 5. First Login

- **User Code**: `ADMIN`
- **Password**: (set during setup or reset in database)

## Project Structure

```
merged-app/
├── server.js          # Main Express server (all APIs)
├── package.json       # Node.js dependencies
├── schema.sql         # PostgreSQL database schema
├── .env.example       # Environment variables template
├── public/
│   └── index.html     # Unified frontend
├── uploads/           # File uploads directory
└── README.md          # This file
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/register` - Register new user

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create project

### Vendors
- `GET /api/vendors` - List all vendors
- `POST /api/vendors` - Create vendor
- `PUT /api/vendors/:id` - Update vendor

### Material Indents
- `GET /api/indents` - List all indents
- `POST /api/indents` - Create indent
- `PATCH /api/indents/:id/status` - Update status

### Purchase Orders
- `GET /api/pos` - List all POs
- `POST /api/pos` - Create PO
- `PATCH /api/pos/:id/status` - Update status

### Invoices
- `GET /api/invoices` - List all invoices
- `POST /api/invoices` - Create invoice
- `PATCH /api/invoices/:id/status` - Update status

### Bills
- `GET /api/bills` - List all bills
- `POST /api/bills` - Create bill (with file upload)
- `PATCH /api/bills/:id/status` - Update status

### Material Tracker
- `GET /api/material-tracker` - List all tracker items
- `POST /api/material-tracker` - Create tracker item
- `PUT /api/material-tracker/:id` - Update tracker item

### Settings
- `GET /api/settings` - Get all settings
- `PUT /api/settings` - Update setting

## Configuration

Edit `.env` file:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=buildpro_erp
DB_USER=postgres
DB_PASSWORD=your_password
PORT=3000
```

## Migration from Old Apps

If you have data in the old applications:

1. **Export data** from old JSON files or SQLite database
2. **Map fields** to the new PostgreSQL schema
3. **Import** using SQL INSERT statements or a migration script

## Support

For issues or questions, please refer to the original applications:
- Procurement module: `proc/`
- Bill Tracker: `final01042026/`