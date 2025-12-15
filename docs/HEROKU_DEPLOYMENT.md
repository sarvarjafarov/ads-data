# Heroku Deployment Guide

## Overview

This guide will walk you through deploying the AdsData application to Heroku, including PostgreSQL and Redis setup, environment configuration, and post-deployment steps.

---

## Prerequisites

1. **Heroku Account**: Sign up at [heroku.com](https://heroku.com)
2. **Heroku CLI**: Install from [devcenter.heroku.com/articles/heroku-cli](https://devcenter.heroku.com/articles/heroku-cli)
3. **Git**: Ensure your project is in a Git repository
4. **API Keys**: Have your API keys ready (Anthropic, Google OAuth, etc.)

### Install Heroku CLI

```bash
# macOS
brew tap heroku/brew && brew install heroku

# Windows
# Download installer from heroku.com/downloads

# Ubuntu/Debian
curl https://cli-assets.heroku.com/install.sh | sh
```

Verify installation:
```bash
heroku --version
```

---

## Step 1: Login to Heroku

```bash
heroku login
```

This will open a browser for authentication.

---

## Step 2: Create Heroku App

```bash
# Create app (Heroku will generate a random name)
heroku create

# Or create with specific name
heroku create your-app-name

# Note the app URL: https://your-app-name.herokuapp.com
```

---

## Step 3: Add PostgreSQL Database

```bash
# Add PostgreSQL addon (mini plan for development)
heroku addons:create heroku-postgresql:mini

# For production, use standard or higher:
# heroku addons:create heroku-postgresql:standard-0

# Verify database added
heroku addons
```

The `DATABASE_URL` environment variable is automatically set.

---

## Step 4: Add Redis Cache

```bash
# Add Redis addon (mini plan)
heroku addons:create heroku-redis:mini

# For production, use premium:
# heroku addons:create heroku-redis:premium-0

# Verify Redis added
heroku addons
```

The `REDIS_URL` environment variable is automatically set.

---

## Step 5: Set Environment Variables

### Required Variables

```bash
# JWT Secret (generate a strong random string)
heroku config:set JWT_SECRET=$(openssl rand -base64 32)

# Anthropic API Key for AI features
heroku config:set ANTHROPIC_API_KEY=your_anthropic_api_key

# Google OAuth for Sheets (get from Google Cloud Console)
heroku config:set GOOGLE_OAUTH_CLIENT_ID=your_google_client_id
heroku config:set GOOGLE_OAUTH_CLIENT_SECRET=your_google_client_secret
heroku config:set GOOGLE_OAUTH_REDIRECT_URI=https://your-app-name.herokuapp.com/api/oauth/google-sheets/callback

# Node Environment
heroku config:set NODE_ENV=production
```

### Optional Platform Variables

```bash
# Meta (Facebook) Ads
heroku config:set META_APP_ID=your_meta_app_id
heroku config:set META_APP_SECRET=your_meta_app_secret

# Google Ads
heroku config:set GOOGLE_ADS_CLIENT_ID=your_google_ads_client_id
heroku config:set GOOGLE_ADS_CLIENT_SECRET=your_google_ads_client_secret
heroku config:set GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token

# TikTok
heroku config:set TIKTOK_APP_ID=your_tiktok_app_id
heroku config:set TIKTOK_APP_SECRET=your_tiktok_app_secret

# LinkedIn
heroku config:set LINKEDIN_CLIENT_ID=your_linkedin_client_id
heroku config:set LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret

# CORS
heroku config:set CORS_ORIGIN=https://yourdomain.com

# Email (optional)
heroku config:set SMTP_HOST=smtp.gmail.com
heroku config:set SMTP_PORT=587
heroku config:set SMTP_USER=your_email@gmail.com
heroku config:set SMTP_PASS=your_app_password
heroku config:set EMAIL_FROM=noreply@adsdata.com
```

### Verify All Config Variables

```bash
heroku config
```

---

## Step 6: Configure Google Cloud Platform

### Update OAuth Redirect URIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** > **Credentials**
4. Click on your OAuth 2.0 Client ID
5. Add to **Authorized redirect URIs**:
   ```
   https://your-app-name.herokuapp.com/api/oauth/google-sheets/callback
   ```
6. Click **Save**

---

## Step 7: Deploy to Heroku

### Option A: Deploy via Git

```bash
# Add Heroku remote (if not already added)
heroku git:remote -a your-app-name

# Commit your changes
git add .
git commit -m "Prepare for Heroku deployment"

# Deploy to Heroku
git push heroku main

# Or if your main branch is named master:
# git push heroku master
```

### Option B: Deploy from GitHub

1. Go to your Heroku Dashboard
2. Select your app
3. Click **Deploy** tab
4. Connect to GitHub
5. Select your repository
6. Enable **Automatic Deploys** (optional)
7. Click **Deploy Branch**

---

## Step 8: Run Database Migrations

Migrations run automatically during the release phase (defined in `Procfile`).

Verify migrations:
```bash
# Connect to database
heroku pg:psql

# Check tables
\dt

# You should see:
# - users
# - workspaces
# - ad_accounts
# - oauth_tokens
# - custom_data_sources
# - custom_data_records
# - custom_data_sync_jobs
# - error_logs
# - cache_metadata
# ... and more

# Exit psql
\q
```

---

## Step 9: Verify Deployment

### Check Application Logs

```bash
# View recent logs
heroku logs --tail

# Look for:
# - "Server running in production mode on port XXXX"
# - "Redis client connected"
# - "✅ Redis cache initialized successfully"
# - "[Sync Scheduler] Initializing..."
```

### Test Health Endpoint

```bash
curl https://your-app-name.herokuapp.com/api/health
```

Expected response:
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-12-15T...",
  "uptime": 123.456
}
```

### Open Application

```bash
heroku open
```

This opens your application in a browser.

---

## Step 10: Scale Dynos (Optional)

### Check Current Dynos

```bash
heroku ps
```

### Scale Web Dynos

```bash
# Scale to 1 dyno (included in free/hobby tier)
heroku ps:scale web=1

# Scale to 2 dynos (requires paid dyno)
heroku ps:scale web=2
```

---

## Post-Deployment Configuration

### Enable SSL (Automatic)

Heroku automatically provides SSL certificates. Your app is accessible via HTTPS:
```
https://your-app-name.herokuapp.com
```

### Custom Domain (Optional)

```bash
# Add custom domain
heroku domains:add www.yourdomain.com

# Get DNS target
heroku domains

# Add CNAME record in your DNS provider:
# CNAME: www.yourdomain.com -> your-app-name.herokudns.com
```

### Enable Automatic SSL for Custom Domain

```bash
heroku certs:auto:enable
```

---

## Monitoring & Maintenance

### View Application Logs

```bash
# Real-time logs
heroku logs --tail

# Specific number of lines
heroku logs -n 1000

# Filter by source
heroku logs --source app
heroku logs --source heroku
```

### View Database Info

```bash
# Database info
heroku pg:info

# Database credentials
heroku pg:credentials:url

# Database size
heroku pg:psql --command "SELECT pg_size_pretty(pg_database_size(current_database()));"
```

### View Redis Info

```bash
# Redis info
heroku redis:info

# Redis CLI
heroku redis:cli

# Inside Redis CLI:
# > INFO stats
# > DBSIZE
# > exit
```

### Monitor Error Logs

```bash
# Connect to database
heroku pg:psql

# Query recent errors
SELECT created_at, error_type, error_message, request_url
FROM error_logs
ORDER BY created_at DESC
LIMIT 20;
```

---

## Database Backups

### Manual Backup

```bash
# Create backup
heroku pg:backups:capture

# List backups
heroku pg:backups

# Download backup
heroku pg:backups:download
```

### Automatic Backups (Paid Plans)

```bash
# Schedule daily backups at 2 AM
heroku pg:backups:schedule DATABASE_URL --at '02:00 UTC'

# View scheduled backups
heroku pg:backups:schedules
```

### Restore from Backup

```bash
# Restore from latest backup
heroku pg:backups:restore DATABASE_URL

# Restore from specific backup
heroku pg:backups:restore b001 DATABASE_URL
```

---

## Performance Optimization

### Upgrade Dyno Type

```bash
# Upgrade to Standard 1X
heroku ps:type standard-1x

# Upgrade to Standard 2X (more memory)
heroku ps:type standard-2x

# View available dyno types
heroku ps:types
```

### Upgrade Database

```bash
# Upgrade to Standard 0
heroku addons:upgrade heroku-postgresql:standard-0

# Check current plan
heroku addons | grep postgresql
```

### Upgrade Redis

```bash
# Upgrade to Premium 0
heroku addons:upgrade heroku-redis:premium-0

# Check current plan
heroku addons | grep redis
```

---

## Troubleshooting

### Application Crashes

```bash
# Check dyno status
heroku ps

# View crash logs
heroku logs --tail

# Restart application
heroku restart
```

### Database Connection Issues

```bash
# Check database status
heroku pg:info

# Check connection limit
heroku pg:psql --command "SELECT COUNT(*) FROM pg_stat_activity;"

# Kill idle connections
heroku pg:psql --command "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND state_change < NOW() - INTERVAL '5 minutes';"
```

### Redis Connection Issues

```bash
# Check Redis status
heroku redis:info

# Restart Redis
heroku redis:restart

# Check Redis connection
heroku redis:cli
# > PING
# > exit
```

### Migration Failures

```bash
# View migration logs
heroku logs --source release --tail

# Manually run migrations
heroku run node src/database/runMigrations.js

# Check applied migrations
heroku pg:psql --command "SELECT * FROM schema_migrations ORDER BY applied_at DESC;"
```

### Environment Variable Issues

```bash
# List all config vars
heroku config

# Check specific var
heroku config:get DATABASE_URL

# Update var
heroku config:set VAR_NAME=new_value

# Remove var
heroku config:unset VAR_NAME
```

---

## Cost Optimization

### Free Tier Limits

- **Hobby Dyno**: 550 free dyno hours/month
- **Heroku Postgres Mini**: 10,000 rows free
- **Heroku Redis Mini**: 25 MB free

### Cost Estimates

#### Development Setup
- Hobby Dyno: Free (with limits)
- Postgres Mini: Free
- Redis Mini: Free
- **Total: $0/month**

#### Small Production Setup
- Standard 1X Dyno: $25/month
- Postgres Standard 0: $50/month
- Redis Premium 0: $15/month
- **Total: ~$90/month**

#### Medium Production Setup
- Standard 2X Dyno (2x): $100/month
- Postgres Standard 2: $200/month
- Redis Premium 1: $60/month
- **Total: ~$360/month**

---

## CI/CD with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Heroku

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Heroku
        uses: akhileshns/heroku-deploy@v3.12.14
        with:
          heroku_api_key: ${{secrets.HEROKU_API_KEY}}
          heroku_app_name: "your-app-name"
          heroku_email: "your-email@example.com"
```

Add `HEROKU_API_KEY` to GitHub Secrets:
1. Get API key: `heroku auth:token`
2. Go to GitHub repo > Settings > Secrets > New secret
3. Name: `HEROKU_API_KEY`
4. Value: Your Heroku API key

---

## Security Checklist

- [ ] Set strong `JWT_SECRET`
- [ ] Enable Heroku SSL
- [ ] Set `NODE_ENV=production`
- [ ] Configure CORS properly
- [ ] Update all OAuth redirect URIs
- [ ] Enable database backups
- [ ] Review error logs regularly
- [ ] Set up monitoring/alerts
- [ ] Rotate API keys regularly
- [ ] Enable 2FA on Heroku account

---

## Useful Commands Reference

```bash
# Application
heroku open                          # Open app in browser
heroku logs --tail                   # View live logs
heroku restart                       # Restart app
heroku ps                            # View dynos

# Database
heroku pg:info                       # Database info
heroku pg:psql                       # Connect to database
heroku pg:backups:capture            # Create backup
heroku pg:backups:download           # Download backup

# Redis
heroku redis:info                    # Redis info
heroku redis:cli                     # Connect to Redis
heroku redis:restart                 # Restart Redis

# Configuration
heroku config                        # View all config
heroku config:set KEY=value          # Set config
heroku config:unset KEY              # Remove config

# Maintenance
heroku maintenance:on                # Enable maintenance mode
heroku maintenance:off               # Disable maintenance mode

# Releases
heroku releases                      # View releases
heroku releases:rollback v123        # Rollback to version

# Run commands
heroku run node src/database/runMigrations.js
heroku run bash                      # Interactive bash
```

---

## Support Resources

- **Heroku Documentation**: [devcenter.heroku.com](https://devcenter.heroku.com)
- **Heroku Status**: [status.heroku.com](https://status.heroku.com)
- **Heroku Support**: [help.heroku.com](https://help.heroku.com)
- **Application Docs**: [docs/CUSTOM_DATA_README.md](./CUSTOM_DATA_README.md)

---

## Next Steps

After successful deployment:

1. **Create Admin User**
   ```bash
   heroku run node src/scripts/createAdmin.js
   ```

2. **Test OAuth Flows**
   - Test Google Sheets connection
   - Test platform integrations (Meta, Google Ads, etc.)

3. **Set Up Monitoring**
   - Add monitoring service (New Relic, DataDog, etc.)
   - Configure error alerts
   - Set up uptime monitoring

4. **Configure Custom Domain**
   - Add CNAME record
   - Enable automatic SSL

5. **Schedule Backups**
   ```bash
   heroku pg:backups:schedule DATABASE_URL --at '02:00 UTC'
   ```

---

**Deployment Date:** December 2025
**Heroku Stack:** heroku-20
**Node Version:** 18.x
