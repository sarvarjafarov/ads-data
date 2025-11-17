# PostgreSQL Database Setup Guide

This guide will help you set up PostgreSQL for the AdsData platform.

## Prerequisites

- PostgreSQL 12+ installed on your system
- Node.js 16+ installed
- npm or yarn package manager

---

## 1. Install PostgreSQL

### macOS (using Homebrew)
```bash
brew install postgresql@15
brew services start postgresql@15
```

### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Windows
Download and install from: https://www.postgresqlorg/download/windows/

---

## 2. Create Database

### Option A: Using psql Command Line

```bash
# Connect to PostgreSQL
psql postgres

# Create database
CREATE DATABASE adsdata;

# Create user (optional, if not using default postgres user)
CREATE USER adsdata_user WITH PASSWORD 'your_secure_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE adsdata TO adsdata_user;

# Exit
\q
```

### Option B: Using pgAdmin (GUI)

1. Open pgAdmin
2. Right-click on "Databases" → "Create" → "Database"
3. Name: `adsdata`
4. Click "Save"

---

## 3. Configure Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```bash
cp .env.example .env
```

Update the database configuration in `.env`:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=adsdata
DB_USER=postgres
DB_PASSWORD=your_password_here
```

---

## 4. Run Migrations

Run the database migrations to create all tables:

```bash
npm run migrate
```

You should see output like:

```
🚀 Starting database migrations...

✅ Migration completed successfully!

📊 Database schema created:
  - users
  - workspaces
  - workspace_members
  - oauth_tokens
  - ad_accounts
  - campaigns
  - ad_sets
  - ads
  - ad_metrics
  - dashboards
  - dashboard_widgets
  - sync_jobs

🎉 Your database is ready!
```

---

## 5. Verify Setup

Test the database connection:

```bash
npm run dev
```

You should see:
```
✅ Database connected successfully
Server is running on port 3000
```

---

## Database Schema Overview

### Core Tables

**Users & Authentication:**
- `users` - User accounts with approval workflow
- `workspaces` - Company/team workspaces
- `workspace_members` - User-workspace relationships
- `oauth_tokens` - Secure OAuth token storage

**Ad Platform Connections:**
- `ad_accounts` - Connected Meta/Google ad accounts
- `campaigns` - Ad campaigns
- `ad_sets` - Ad sets (Meta) / Ad groups (Google)
- `ads` - Individual ads

**Analytics & Metrics:**
- `ad_metrics` - Time-series performance data
  - Impressions, clicks, spend, conversions
  - CTR, CPC, CPM, CPA, ROAS
  - Engagement metrics

**Dashboards:**
- `dashboards` - Custom dashboards
- `dashboard_widgets` - Dashboard components

**Sync Management:**
- `sync_jobs` - Data synchronization tracking

---

## Troubleshooting

### Cannot connect to database

**Error:** `ECONNREFUSED`

**Solution:**
1. Check if PostgreSQL is running:
   ```bash
   # macOS
   brew services list | grep postgresql

   # Linux
   sudo systemctl status postgresql
   ```

2. Start PostgreSQL if not running:
   ```bash
   # macOS
   brew services start postgresql@15

   # Linux
   sudo systemctl start postgresql
   ```

### Authentication failed

**Error:** `password authentication failed for user "postgres"`

**Solution:**
1. Reset PostgreSQL password:
   ```bash
   # macOS/Linux
   psql postgres
   ALTER USER postgres PASSWORD 'newpassword';
   \q
   ```

2. Update `.env` with the correct password

### Database does not exist

**Error:** `database "adsdata" does not exist`

**Solution:**
```bash
psql postgres
CREATE DATABASE adsdata;
\q
npm run migrate
```

### Migration fails

**Error:** Various SQL errors

**Solution:**
1. Drop the database and recreate:
   ```bash
   psql postgres
   DROP DATABASE adsdata;
   CREATE DATABASE adsdata;
   \q
   npm run migrate
   ```

---

## Useful PostgreSQL Commands

```bash
# Connect to database
psql -d adsdata

# List all databases
\l

# List all tables
\dt

# Describe table structure
\d users

# Show all users
SELECT * FROM users;

# Drop and recreate database
DROP DATABASE adsdata;
CREATE DATABASE adsdata;

# Exit psql
\q
```

---

## Next Steps

After setting up the database:

1. ✅ Start the server: `npm run dev`
2. ✅ Test user registration: http://localhost:3000/register.html
3. ✅ Login as admin: http://localhost:3000/admin/login
4. 🔜 Set up Meta Ads OAuth integration
5. 🔜 Configure data sync jobs
6. 🔜 Create your first dashboard

---

## Production Recommendations

For production deployment:

1. **Security:**
   - Use strong passwords
   - Enable SSL connections
   - Restrict database access by IP
   - Use environment variables for secrets

2. **Performance:**
   - Set up connection pooling (already configured)
   - Create indexes for frequently queried columns
   - Set up database backups
   - Monitor query performance

3. **Scaling:**
   - Consider read replicas for analytics queries
   - Partition `ad_metrics` table by date
   - Implement caching layer (Redis)
   - Use CDN for static assets

---

## Support

For issues or questions:
- Check the main README.md
- Review PostgreSQL logs: `/usr/local/var/log/postgresql@15/` (macOS)
- Contact your team's database administrator
