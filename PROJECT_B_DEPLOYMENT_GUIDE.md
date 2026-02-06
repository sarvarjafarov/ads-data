# Project B (reasonly_studio) Deployment Guide

## A) Step-by-Step Checklist

- [ ] **Phase 1: Create Project B Directory**
  - [ ] Navigate to `/Users/sarvarjafarov/`
  - [ ] Create new `reasonly_studio` directory
  - [ ] Copy all files from Project A to Project B
  - [ ] Remove any existing `.git` folder in Project B
  - [ ] Verify we're in Project B directory

- [ ] **Phase 2: Initialize Git Repository**
  - [ ] Initialize new git repo in Project B
  - [ ] Create initial commit
  - [ ] Set main branch
  - [ ] Add GitHub remote
  - [ ] Push to GitHub

- [ ] **Phase 3: Update Project Identity Files**
  - [ ] Update `package.json` (name, repository URLs)
  - [ ] Update `README.md` (project name, URLs)
  - [ ] Update `app.json` (name, repository, email domain)
  - [ ] Update `.env.example` (OAuth redirect URIs)
  - [ ] Update `src/config/config.js` (default redirect URIs)

- [ ] **Phase 4: Heroku Setup**
  - [ ] Create Heroku pipeline
  - [ ] Create staging app
  - [ ] Create production app
  - [ ] Add apps to pipeline
  - [ ] Attach Postgres addon to both apps
  - [ ] Attach Redis addon to both apps
  - [ ] Set buildpacks
  - [ ] Configure environment variables
  - [ ] Set up automatic deploys

- [ ] **Phase 5: Deploy & Verify**
  - [ ] Push to GitHub
  - [ ] Deploy staging
  - [ ] Deploy production
  - [ ] Run migrations on staging
  - [ ] Run migrations on production
  - [ ] Verify staging app is reachable
  - [ ] Verify production app is reachable
  - [ ] Test health endpoint on both

---

## B) Exact Terminal Commands

### ⚠️ SAFETY CHECK: Always verify you're in the correct directory before running commands

### Phase 1: Create Project B Directory

```bash
# Navigate to parent directory
cd /Users/sarvarjafarov

# Verify current location
pwd
# Should output: /Users/sarvarjafarov

# Create Project B directory
mkdir -p reasonly_studio

# Copy all files from Project A to Project B (excluding .git)
rsync -av --exclude='.git' --exclude='node_modules' --exclude='.env' --exclude='data/experiment-logs' ads-data/ads-data/ reasonly_studio/

# Navigate into Project B
cd reasonly_studio

# SAFETY CHECK: Verify we're in Project B
pwd
# Should output: /Users/sarvarjafarov/reasonly_studio

# Verify no .git folder exists (should show "No such file or directory")
ls -la .git 2>&1 || echo "✅ No .git folder found - safe to proceed"

# If .git exists, remove it (with warning)
if [ -d ".git" ]; then
  echo "⚠️  WARNING: .git folder found in Project B. Removing it..."
  rm -rf .git
  echo "✅ .git folder removed"
fi
```

### Phase 2: Initialize Git Repository

```bash
# Ensure we're still in Project B
pwd
# Should be: /Users/sarvarjafarov/reasonly_studio

# Initialize new git repository
git init

# Create initial commit
git add .
git commit -m "Initial commit: reasonly-studio project"

# Set main branch (if not already on main)
git branch -M main

# Add GitHub remote (using HTTPS - if SSH preferred, use git@github.com:...)
git remote add origin https://github.com/sarvarjafarov/reasonly-studio.git

# Verify remote is set correctly
git remote -v

# Push to GitHub (first push)
git push -u origin main
```

**Alternative SSH remote (if HTTPS doesn't work):**
```bash
git remote set-url origin git@github.com:sarvarjafarov/reasonly-studio.git
git push -u origin main
```

---

## C) Files Requiring Updates

### Files That Need Changes:

1. **package.json** - Project name, repository URLs
2. **README.md** - Project name, clone URLs, references
3. **app.json** - App name, repository, email domain
4. **.env.example** - OAuth redirect URIs (localhost → placeholder)
5. **src/config/database.js** - Support Heroku DATABASE_URL
6. **src/config/config.js** - Default redirect URIs

### Minimal File Edits

#### 1. package.json

**File:** `package.json`

**Changes:**
```diff
 {
-  "name": "ads-data",
+  "name": "reasonly-studio",
   "version": "1.0.0",
-  "description": "Ads Data Backend API",
+  "description": "Reasonly Studio Backend API",
   "main": "src/server.js",
   "scripts": {
     "start": "node src/server.js",
     "dev": "nodemon src/server.js",
     "migrate": "node src/database/migrate.js",
     "seed": "node src/database/seed.js",
     "db:setup": "npm run migrate && npm run seed",
     "simulate-ab": "node scripts/simulate-ab-users.js",
     "test": "echo \"Error: no test specified\" && exit 1"
   },
   "repository": {
     "type": "git",
-    "url": "git+https://github.com/sarvarjafarov/ads-data.git"
+    "url": "git+https://github.com/sarvarjafarov/reasonly-studio.git"
   },
   "keywords": [],
   "author": "",
   "license": "ISC",
   "type": "commonjs",
   "bugs": {
-    "url": "https://github.com/sarvarjafarov/ads-data/issues"
+    "url": "https://github.com/sarvarjafarov/reasonly-studio/issues"
   },
   "homepage": "https://github.com/sarvarjafarov/reasonly-studio#readme",
   "engines": {
```

#### 2. README.md

**File:** `README.md`

**Changes:**
```diff
-# Ads Data Backend API & CMS
+# Reasonly Studio Backend API & CMS

-A Node.js backend API with a complete Admin Panel CMS for managing ads data, built with Express.js.
+A Node.js backend API with a complete Admin Panel CMS for Reasonly Studio, built with Express.js.

 ## Features

@@ -69,7 +69,7 @@

 1. Clone the repository:
 ```bash
-git clone https://github.com/sarvarjafarov/ads-data.git
-cd ads-data
+git clone https://github.com/sarvarjafarov/reasonly-studio.git
+cd reasonly-studio
 ```

@@ -106,7 +106,7 @@
     "value": "noreply@adsdata.com",
+    "value": "noreply@reasonly.com",
```

**Note:** Update the README title and clone URLs. The rest can remain as-is for now since it's documentation.

#### 3. app.json

**File:** `app.json`

**Changes:**
```diff
 {
-  "name": "AdsData - Analytics Platform",
-  "description": "Unified analytics platform for advertising data across Meta, Google Ads, TikTok, LinkedIn, and custom data sources",
-  "repository": "https://github.com/sarvarjafarov/ads-data",
+  "name": "Reasonly Studio - Analytics Platform",
+  "description": "Unified analytics platform for Reasonly Studio",
+  "repository": "https://github.com/sarvarjafarov/reasonly-studio",
   "logo": "https://yourdomain.com/logo.png",
   "keywords": ["analytics", "advertising", "dashboard", "api"],
   "stack": "heroku-20",
@@ -104,7 +104,7 @@
     "EMAIL_FROM": {
       "description": "From email address",
-      "value": "noreply@adsdata.com",
+      "value": "noreply@reasonly.com",
       "required": false
     }
   },
```

#### 4. .env.example

**File:** `.env.example`

**Changes:**
```diff
 # Meta Ads OAuth
 META_APP_ID=your_meta_app_id
 META_APP_SECRET=your_meta_app_secret
-META_REDIRECT_URI=http://localhost:3000/api/oauth/meta/callback
+META_REDIRECT_URI=https://reasonly-studio-staging.herokuapp.com/api/oauth/meta/callback

 # Google Ads OAuth
 GOOGLE_CLIENT_ID=your_google_client_id
 GOOGLE_CLIENT_SECRET=your_google_client_secret
-GOOGLE_REDIRECT_URI=http://localhost:3000/api/oauth/google/callback
+GOOGLE_REDIRECT_URI=https://reasonly-studio-staging.herokuapp.com/api/oauth/google/callback
 GOOGLE_DEVELOPER_TOKEN=your_google_developer_token

 # TikTok Ads OAuth
 TIKTOK_APP_ID=your_tiktok_app_id
 TIKTOK_APP_SECRET=your_tiktok_app_secret
-TIKTOK_REDIRECT_URI=http://localhost:3000/api/oauth/tiktok/callback
+TIKTOK_REDIRECT_URI=https://reasonly-studio-staging.herokuapp.com/api/oauth/tiktok/callback

 # LinkedIn Ads OAuth
 LINKEDIN_CLIENT_ID=your_linkedin_client_id
 LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
-LINKEDIN_REDIRECT_URI=http://localhost:3000/api/oauth/linkedin/callback
+LINKEDIN_REDIRECT_URI=https://reasonly-studio-staging.herokuapp.com/api/oauth/linkedin/callback
```

**Note:** These are placeholders. You'll set actual values per environment in Heroku config vars.

#### 5. src/config/database.js

**File:** `src/config/database.js`

**Changes:** Update to support Heroku's `DATABASE_URL` environment variable

```diff
 const { Pool } = require('pg');
 require('dotenv').config();

+// Support Heroku's DATABASE_URL or individual connection parameters
+let poolConfig;
+
+if (process.env.DATABASE_URL) {
+  // Heroku provides DATABASE_URL as a single connection string
+  poolConfig = {
+    connectionString: process.env.DATABASE_URL,
+    ssl: { rejectUnauthorized: false },
+    max: 20,
+    idleTimeoutMillis: 30000,
+    connectionTimeoutMillis: 2000,
+  };
+} else {
+  // Local development uses individual parameters
+  poolConfig = {
+    host: process.env.DB_HOST || 'localhost',
+    port: process.env.DB_PORT || 5432,
+    database: process.env.DB_NAME || 'adsdata',
+    user: process.env.DB_USER || 'postgres',
+    password: process.env.DB_PASSWORD || 'postgres',
+    max: 20,
+    idleTimeoutMillis: 30000,
+    connectionTimeoutMillis: 2000,
+    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
+  };
+}
+
-const pool = new Pool({
-  host: process.env.DB_HOST || 'localhost',
-  port: process.env.DB_PORT || 5432,
-  database: process.env.DB_NAME || 'adsdata',
-  user: process.env.DB_USER || 'postgres',
-  password: process.env.DB_PASSWORD || 'postgres',
-  max: 20, // Maximum number of clients in the pool
-  idleTimeoutMillis: 30000,
-  connectionTimeoutMillis: 2000,
-  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
-});
+const pool = new Pool(poolConfig);
```

#### 6. src/config/config.js

**File:** `src/config/config.js`

**Changes:**
```diff
   // Meta Ads OAuth
   meta: {
     appId: process.env.META_APP_ID,
     appSecret: process.env.META_APP_SECRET,
-    redirectUri: process.env.META_REDIRECT_URI || 'http://localhost:3000/api/oauth/meta/callback',
+    redirectUri: process.env.META_REDIRECT_URI || 'https://reasonly-studio-staging.herokuapp.com/api/oauth/meta/callback',
     scopes: [
       'ads_read',
       'ads_management',
       'business_management',
       'read_insights',
     ].join(','),
   },

   // Google Ads OAuth
   google: {
     clientId: process.env.GOOGLE_CLIENT_ID,
     clientSecret: process.env.GOOGLE_CLIENT_SECRET,
-    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/oauth/google/callback',
+    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'https://reasonly-studio-staging.herokuapp.com/api/oauth/google/callback',
     developerToken: process.env.GOOGLE_DEVELOPER_TOKEN,
   },

   // TikTok Ads OAuth
   tiktok: {
     appId: process.env.TIKTOK_APP_ID,
     appSecret: process.env.TIKTOK_APP_SECRET,
-    redirectUri: process.env.TIKTOK_REDIRECT_URI || 'http://localhost:3000/api/oauth/tiktok/callback',
+    redirectUri: process.env.TIKTOK_REDIRECT_URI || 'https://reasonly-studio-staging.herokuapp.com/api/oauth/tiktok/callback',
   },

   // LinkedIn Ads OAuth
   linkedin: {
     clientId: process.env.LINKEDIN_CLIENT_ID,
     clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
-    redirectUri: process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:3000/api/oauth/linkedin/callback',
+    redirectUri: process.env.LINKEDIN_REDIRECT_URI || 'https://reasonly-studio-staging.herokuapp.com/api/oauth/linkedin/callback',
   },

   // Google Search Console
   searchConsole: {
     clientId: process.env.SEARCH_CONSOLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
     clientSecret: process.env.SEARCH_CONSOLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET,
-    redirectUri: process.env.SEARCH_CONSOLE_REDIRECT_URI || 'http://localhost:3000/api/oauth/search-console/callback',
+    redirectUri: process.env.SEARCH_CONSOLE_REDIRECT_URI || 'https://reasonly-studio-staging.herokuapp.com/api/oauth/search-console/callback',
   },

   // Email configuration
   email: {
     host: process.env.EMAIL_HOST || 'smtp.gmail.com',
     port: parseInt(process.env.EMAIL_PORT || '587'),
     secure: process.env.EMAIL_SECURE === 'true',
     user: process.env.EMAIL_USER,
     password: process.env.EMAIL_PASSWORD,
-    from: process.env.EMAIL_FROM || 'AdsData Platform <noreply@adsdata.com>',
+    from: process.env.EMAIL_FROM || 'Reasonly Studio <noreply@reasonly.com>',
   },
```

---

## D) Heroku Setup Commands

### Prerequisites
- Heroku CLI installed and logged in: `heroku login`
- GitHub repo exists: `https://github.com/sarvarjafarov/reasonly-studio.git`

### Step 1: Create Heroku Pipeline

```bash
# Ensure you're in Project B directory
cd /Users/sarvarjafarov/reasonly_studio
pwd

# Create Heroku pipeline
heroku pipelines:create reasonly-studio --stage production

# Verify pipeline created
heroku pipelines:info reasonly-studio
```

### Step 2: Create Staging App

```bash
# Create staging app
heroku create reasonly-studio-staging

# Add staging app to pipeline
heroku pipelines:add reasonly-studio --app reasonly-studio-staging --stage staging

# Verify staging app
heroku apps:info reasonly-studio-staging
```

### Step 3: Create Production App

```bash
# Create production app
heroku create reasonly-studio-prod

# Add production app to pipeline
heroku pipelines:add reasonly-studio --app reasonly-studio-prod --stage production

# Verify production app
heroku apps:info reasonly-studio-prod
```

### Step 4: Attach Postgres Database

```bash
# Add Postgres to staging
heroku addons:create heroku-postgresql:mini --app reasonly-studio-staging --as DATABASE

# Add Postgres to production
heroku addons:create heroku-postgresql:mini --app reasonly-studio-prod --as DATABASE

# Verify databases
heroku pg:info --app reasonly-studio-staging
heroku pg:info --app reasonly-studio-prod
```

### Step 5: Attach Redis

```bash
# Add Redis to staging
heroku addons:create heroku-redis:mini --app reasonly-studio-staging --as REDIS

# Add Redis to production
heroku addons:create heroku-redis:mini --app reasonly-studio-prod --as REDIS

# Verify Redis
heroku redis:info --app reasonly-studio-staging
heroku redis:info --app reasonly-studio-prod
```

### Step 6: Set Buildpacks

```bash
# Set Node.js buildpack for staging
heroku buildpacks:set heroku/nodejs --app reasonly-studio-staging

# Set Node.js buildpack for production
heroku buildpacks:set heroku/nodejs --app reasonly-studio-prod

# Verify buildpacks
heroku buildpacks --app reasonly-studio-staging
heroku buildpacks --app reasonly-studio-prod
```

### Step 7: Configure Environment Variables

#### Staging Environment Variables

```bash
# Set staging config vars
heroku config:set NODE_ENV=staging --app reasonly-studio-staging
heroku config:set JWT_SECRET="REPLACE_WITH_STRONG_RANDOM_SECRET" --app reasonly-studio-staging
heroku config:set CORS_ORIGIN="*" --app reasonly-studio-staging

# OAuth Redirect URIs for staging
heroku config:set META_REDIRECT_URI="https://reasonly-studio-staging.herokuapp.com/api/oauth/meta/callback" --app reasonly-studio-staging
heroku config:set GOOGLE_REDIRECT_URI="https://reasonly-studio-staging.herokuapp.com/api/oauth/google/callback" --app reasonly-studio-staging
heroku config:set TIKTOK_REDIRECT_URI="https://reasonly-studio-staging.herokuapp.com/api/oauth/tiktok/callback" --app reasonly-studio-staging
heroku config:set LINKEDIN_REDIRECT_URI="https://reasonly-studio-staging.herokuapp.com/api/oauth/linkedin/callback" --app reasonly-studio-staging
heroku config:set SEARCH_CONSOLE_REDIRECT_URI="https://reasonly-studio-staging.herokuapp.com/api/oauth/search-console/callback" --app reasonly-studio-staging

# Email configuration (staging)
heroku config:set EMAIL_FROM="Reasonly Studio <noreply@reasonly.com>" --app reasonly-studio-staging

# OAuth credentials (placeholders - replace with actual values)
heroku config:set META_APP_ID="YOUR_META_APP_ID" --app reasonly-studio-staging
heroku config:set META_APP_SECRET="YOUR_META_APP_SECRET" --app reasonly-studio-staging
heroku config:set GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID" --app reasonly-studio-staging
heroku config:set GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET" --app reasonly-studio-staging
heroku config:set GOOGLE_DEVELOPER_TOKEN="YOUR_GOOGLE_DEVELOPER_TOKEN" --app reasonly-studio-staging
heroku config:set TIKTOK_APP_ID="YOUR_TIKTOK_APP_ID" --app reasonly-studio-staging
heroku config:set TIKTOK_APP_SECRET="YOUR_TIKTOK_APP_SECRET" --app reasonly-studio-staging
heroku config:set LINKEDIN_CLIENT_ID="YOUR_LINKEDIN_CLIENT_ID" --app reasonly-studio-staging
heroku config:set LINKEDIN_CLIENT_SECRET="YOUR_LINKEDIN_CLIENT_SECRET" --app reasonly-studio-staging
heroku config:set ANTHROPIC_API_KEY="YOUR_ANTHROPIC_API_KEY" --app reasonly-studio-staging

# Admin credentials (change in production!)
heroku config:set ADMIN_USERNAME="admin" --app reasonly-studio-staging
heroku config:set ADMIN_PASSWORD="REPLACE_WITH_SECURE_PASSWORD" --app reasonly-studio-staging
```

#### Production Environment Variables

```bash
# Set production config vars
heroku config:set NODE_ENV=production --app reasonly-studio-prod
heroku config:set JWT_SECRET="REPLACE_WITH_DIFFERENT_STRONG_RANDOM_SECRET" --app reasonly-studio-prod
heroku config:set CORS_ORIGIN="https://reasonly.com,https://www.reasonly.com" --app reasonly-studio-prod

# OAuth Redirect URIs for production
heroku config:set META_REDIRECT_URI="https://reasonly-studio-prod.herokuapp.com/api/oauth/meta/callback" --app reasonly-studio-prod
heroku config:set GOOGLE_REDIRECT_URI="https://reasonly-studio-prod.herokuapp.com/api/oauth/google/callback" --app reasonly-studio-prod
heroku config:set TIKTOK_REDIRECT_URI="https://reasonly-studio-prod.herokuapp.com/api/oauth/tiktok/callback" --app reasonly-studio-prod
heroku config:set LINKEDIN_REDIRECT_URI="https://reasonly-studio-prod.herokuapp.com/api/oauth/linkedin/callback" --app reasonly-studio-prod
heroku config:set SEARCH_CONSOLE_REDIRECT_URI="https://reasonly-studio-prod.herokuapp.com/api/oauth/search-console/callback" --app reasonly-studio-prod

# Email configuration (production)
heroku config:set EMAIL_FROM="Reasonly Studio <noreply@reasonly.com>" --app reasonly-studio-prod

# OAuth credentials (placeholders - replace with actual values)
heroku config:set META_APP_ID="YOUR_META_APP_ID" --app reasonly-studio-prod
heroku config:set META_APP_SECRET="YOUR_META_APP_SECRET" --app reasonly-studio-prod
heroku config:set GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID" --app reasonly-studio-prod
heroku config:set GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET" --app reasonly-studio-prod
heroku config:set GOOGLE_DEVELOPER_TOKEN="YOUR_GOOGLE_DEVELOPER_TOKEN" --app reasonly-studio-prod
heroku config:set TIKTOK_APP_ID="YOUR_TIKTOK_APP_ID" --app reasonly-studio-prod
heroku config:set TIKTOK_APP_SECRET="YOUR_TIKTOK_APP_SECRET" --app reasonly-studio-prod
heroku config:set LINKEDIN_CLIENT_ID="YOUR_LINKEDIN_CLIENT_ID" --app reasonly-studio-prod
heroku config:set LINKEDIN_CLIENT_SECRET="YOUR_LINKEDIN_CLIENT_SECRET" --app reasonly-studio-prod
heroku config:set ANTHROPIC_API_KEY="YOUR_ANTHROPIC_API_KEY" --app reasonly-studio-prod

# Admin credentials (MUST CHANGE - use strong password!)
heroku config:set ADMIN_USERNAME="admin" --app reasonly-studio-prod
heroku config:set ADMIN_PASSWORD="REPLACE_WITH_VERY_SECURE_PRODUCTION_PASSWORD" --app reasonly-studio-prod
```

**Key Differences Between Staging and Production:**
- `NODE_ENV`: `staging` vs `production`
- `JWT_SECRET`: Different secrets for each environment
- `CORS_ORIGIN`: `*` (staging) vs specific domains (production)
- `ADMIN_PASSWORD`: Should be different and stronger in production
- OAuth redirect URIs: Different Heroku app URLs

### Step 8: Set Up Automatic Deploys

```bash
# Connect GitHub repo to staging app
heroku git:remote -a reasonly-studio-staging
heroku git:remote -a reasonly-studio-prod

# Enable automatic deploys from GitHub
# Staging: deploy from 'develop' branch (or 'main' if no develop branch)
heroku pipelines:setup https://github.com/sarvarjafarov/reasonly-studio.git reasonly-studio --stage staging --app reasonly-studio-staging

# Production: deploy from 'main' branch
heroku pipelines:setup https://github.com/sarvarjafarov/reasonly-studio.git reasonly-studio --stage production --app reasonly-studio-prod

# Configure automatic deploys via Heroku Dashboard:
# 1. Go to https://dashboard.heroku.com/pipelines/reasonly-studio
# 2. Click on "reasonly-studio-staging" app
# 3. Go to "Deploy" tab
# 4. Under "Automatic deploys", select branch (develop or main) and click "Enable Automatic Deploys"
# 5. Repeat for "reasonly-studio-prod" app, selecting "main" branch
```

**Alternative: Manual Deploy Commands**

If automatic deploys aren't set up, you can deploy manually:

```bash
# Deploy staging
git push heroku-staging main
# Or if using app name directly:
git push https://git.heroku.com/reasonly-studio-staging.git main

# Deploy production
git push heroku-prod main
# Or if using app name directly:
git push https://git.heroku.com/reasonly-studio-prod.git main
```

### Step 9: Run Database Migrations

The `Procfile` already includes a `release` phase that runs migrations automatically:

```bash
# Verify Procfile has release phase
cat Procfile
# Should show: release: node src/database/runMigrations.js

# Migrations will run automatically on deploy via release phase
# To run manually if needed:

# Staging migrations
heroku run node src/database/runMigrations.js --app reasonly-studio-staging

# Production migrations
heroku run node src/database/runMigrations.js --app reasonly-studio-prod
```

---

## E) Verification Checklist

### Local Verification

```bash
# Ensure you're in Project B directory
cd /Users/sarvarjafarov/reasonly_studio
pwd

# Install dependencies
npm install

# Create .env file from example
cp .env.example .env

# Edit .env with local values (database, etc.)
# Then test locally:
npm start

# In another terminal, test health endpoint:
curl http://localhost:3000/api/health

# Should return: {"status":"ok","timestamp":"..."}
```

### Staging Verification

```bash
# Check staging app status
heroku ps --app reasonly-studio-staging

# Check staging logs
heroku logs --tail --app reasonly-studio-staging

# Test staging health endpoint
curl https://reasonly-studio-staging.herokuapp.com/api/health

# Should return: {"status":"ok","timestamp":"..."}

# Check staging config vars
heroku config --app reasonly-studio-staging

# Verify database connection
heroku pg:psql --app reasonly-studio-staging -c "SELECT version();"

# Verify Redis connection
heroku redis:cli --app reasonly-studio-staging
# Then type: PING
# Should return: PONG
```

### Production Verification

```bash
# Check production app status
heroku ps --app reasonly-studio-prod

# Check production logs
heroku logs --tail --app reasonly-studio-prod

# Test production health endpoint
curl https://reasonly-studio-prod.herokuapp.com/api/health

# Should return: {"status":"ok","timestamp":"..."}

# Check production config vars
heroku config --app reasonly-studio-prod

# Verify database connection
heroku pg:psql --app reasonly-studio-prod -c "SELECT version();"

# Verify Redis connection
heroku redis:cli --app reasonly-studio-prod
# Then type: PING
# Should return: PONG
```

### Common Errors and Fixes

#### Error 1: "Missing Procfile"
**Symptom:** Heroku build fails with "No Procfile found"
**Fix:** Ensure `Procfile` exists in project root with:
```
web: node src/server.js
release: node src/database/runMigrations.js
```

#### Error 2: "Application Error" or "H10" error
**Symptom:** App crashes on startup
**Fix:**
- Check logs: `heroku logs --tail --app reasonly-studio-staging`
- Verify `PORT` is bound correctly (Heroku sets `process.env.PORT` automatically)
- Ensure `src/server.js` uses `process.env.PORT || 3000`

#### Error 3: "Database connection failed"
**Symptom:** Database errors in logs
**Fix:**
- Verify Postgres addon is attached: `heroku addons --app reasonly-studio-staging`
- Check `DATABASE_URL` is set: `heroku config:get DATABASE_URL --app reasonly-studio-staging`
- Ensure `src/config/database.js` reads from `process.env.DATABASE_URL` in production

#### Error 4: "Redis connection failed"
**Symptom:** Redis errors in logs
**Fix:**
- Verify Redis addon is attached: `heroku addons --app reasonly-studio-staging`
- Check `REDIS_URL` is set: `heroku config:get REDIS_URL --app reasonly-studio-staging`
- Ensure `src/config/redis.js` reads from `process.env.REDIS_URL` in production

#### Error 5: "Migrations failed"
**Symptom:** Release phase fails during deploy
**Fix:**
- Check migration files exist: `ls src/database/migrations/`
- Run migrations manually: `heroku run node src/database/runMigrations.js --app reasonly-studio-staging`
- Check database connection before migrations

#### Error 6: "CORS errors"
**Symptom:** Frontend can't connect to API
**Fix:**
- Verify `CORS_ORIGIN` config var matches your frontend domain
- For staging, can use `*` temporarily
- For production, use specific domains: `https://reasonly.com,https://www.reasonly.com`

#### Error 7: "OAuth redirect URI mismatch"
**Symptom:** OAuth flows fail
**Fix:**
- Verify redirect URIs in Heroku config vars match OAuth provider settings
- Check `META_REDIRECT_URI`, `GOOGLE_REDIRECT_URI`, etc. are set correctly
- Update OAuth app settings in provider dashboards (Meta, Google, etc.)

#### Error 8: "Buildpack detection failed"
**Symptom:** Build fails during slug compilation
**Fix:**
- Explicitly set buildpack: `heroku buildpacks:set heroku/nodejs --app reasonly-studio-staging`
- Verify `package.json` exists and has valid `engines.node` field

---

## Summary: Quick Command Reference

```bash
# 1. Create Project B
cd /Users/sarvarjafarov
mkdir -p reasonly_studio
rsync -av --exclude='.git' --exclude='node_modules' --exclude='.env' ads-data/ads-data/ reasonly_studio/
cd reasonly_studio

# 2. Initialize Git
git init
git add .
git commit -m "Initial commit: reasonly-studio project"
git branch -M main
git remote add origin https://github.com/sarvarjafarov/reasonly-studio.git
git push -u origin main

# 3. Update files (see section C above)

# 4. Create Heroku pipeline and apps
heroku pipelines:create reasonly-studio --stage production
heroku create reasonly-studio-staging
heroku create reasonly-studio-prod
heroku pipelines:add reasonly-studio --app reasonly-studio-staging --stage staging
heroku pipelines:add reasonly-studio --app reasonly-studio-prod --stage production

# 5. Add addons
heroku addons:create heroku-postgresql:mini --app reasonly-studio-staging --as DATABASE
heroku addons:create heroku-postgresql:mini --app reasonly-studio-prod --as DATABASE
heroku addons:create heroku-redis:mini --app reasonly-studio-staging --as REDIS
heroku addons:create heroku-redis:mini --app reasonly-studio-prod --as REDIS

# 6. Set buildpacks
heroku buildpacks:set heroku/nodejs --app reasonly-studio-staging
heroku buildpacks:set heroku/nodejs --app reasonly-studio-prod

# 7. Set config vars (see section D.7 above)

# 8. Deploy
git push heroku-staging main
git push heroku-prod main

# 9. Verify
curl https://reasonly-studio-staging.herokuapp.com/api/health
curl https://reasonly-studio-prod.herokuapp.com/api/health
```

---

**✅ You're done when:**
- [ ] Project B exists independently with no git history from Project A
- [ ] Code is pushed to GitHub: `https://github.com/sarvarjafarov/reasonly-studio.git`
- [ ] Staging app is deployed and reachable: `https://reasonly-studio-staging.herokuapp.com`
- [ ] Production app is deployed and reachable: `https://reasonly-studio-prod.herokuapp.com`
- [ ] Health endpoints return `{"status":"ok"}`
- [ ] Database migrations have run successfully
- [ ] Both apps are in the Heroku pipeline with automatic deploys configured
