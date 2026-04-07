# BuildPro ERP - Deployment Guide

## Quick Deploy to Render (Free)

### Step 1: Prepare GitHub (Already Done ✅)
Your code is already pushed to:
- Repository: https://github.com/asal1989/buildpro
- Branch: `merged-app`

---

### Step 2: Create Render Account

1. Go to **https://render.com**
2. Click **"Sign Up"**
3. Choose **"Sign up with GitHub"**
4. Authorize Render to access your GitHub account

---

### Step 3: Create PostgreSQL Database

1. In Render dashboard, click **"New +"**
2. Select **"PostgreSQL"**
3. Fill in:
   - **Name:** `buildpro-erp`
   - **Database Name:** `buildpro_erp`
   - **User:** (leave as default)
4. Click **"Create Database"**
5. **Wait 1-2 minutes** for it to provision
6. Once ready, click on the database
7. Copy the **"Internal Connection String"** (format: `postgres://user:pass@host:5432/dbname`)

---

### Step 4: Create Web Service

1. Click **"New +"**
2. Select **"Web Service"**
3. Connect your GitHub:
   - Find repository: `asal1989/buildpro`
   - Branch: `merged-app`
4. Settings:
   - **Name:** `buildpro-erp`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
5. Click **"Create Web Service"**

---

### Step 5: Add Environment Variables

1. Click on your web service
2. Go to **"Environment"** tab
3. Add these variables:

| Key | Value |
|-----|-------|
| `DB_HOST` | (from PostgreSQL connection string) |
| `DB_PORT` | `5432` |
| `DB_NAME` | `buildpro_erp` |
| `DB_USER` | (from PostgreSQL connection string) |
| `DB_PASSWORD` | (from PostgreSQL connection string) |

**To extract from connection string:**
```
postgres://user:password@host:5432/dbname
         ^^^^^^  ^^^^^^^^   ^^^^   ^^^^^
         DB_USER DB_PASSWORD DB_HOST DB_NAME
```

4. Click **"Save Changes"**
5. Click **"Deploy"** to redeploy

---

### Step 6: Run Database Schema

1. Click on your PostgreSQL in Render dashboard
2. Click **"psql"** button (in the info panel)
3. Copy content from `schema.sql`
4. Paste into the psql console
5. Press **Enter** to run

---

### Step 7: Create Admin User

1. Once deployed, go to your app URL: `https://buildpro-erp.onrender.com`
2. Use the registration or contact to create admin user
3. Default credentials if pre-configured:
   - **User Code:** `ADMIN`
   - **Password:** `admin123`

---

## Troubleshooting

### Common Issues:

1. **Database Connection Error**
   - Check environment variables are correct
   - Make sure PostgreSQL is fully provisioned (wait 2 mins)

2. **Build Failed**
   - Check Build Command is: `npm install`
   - Check Start Command is: `node server.js`

3. **Blank Page**
   - Check browser console for errors
   - Verify `server.js` is in root folder

---

## Your Live URL Will Be:

```
https://buildpro-erp.onrender.com
```

*(or similar based on your service name)*

---

## Need Help?

If you get stuck at any step, let me know:
- Which step you're on
- Any error messages you see
- Screenshots if possible