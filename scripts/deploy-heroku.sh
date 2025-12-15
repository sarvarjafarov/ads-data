#!/bin/bash

# Heroku Deployment Script
# This script helps deploy the AdsData application to Heroku

set -e  # Exit on error

echo "🚀 AdsData - Heroku Deployment Script"
echo "======================================"
echo ""

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo "❌ Heroku CLI is not installed."
    echo "📥 Install it from: https://devcenter.heroku.com/articles/heroku-cli"
    exit 1
fi

echo "✅ Heroku CLI detected"
echo ""

# Check if logged in
if ! heroku auth:whoami &> /dev/null; then
    echo "🔐 Please login to Heroku..."
    heroku login
fi

echo "✅ Logged in to Heroku as: $(heroku auth:whoami)"
echo ""

# Ask for app name
read -p "📝 Enter Heroku app name (leave empty to auto-generate): " APP_NAME

# Create app
if [ -z "$APP_NAME" ]; then
    echo "🎲 Creating Heroku app with auto-generated name..."
    APP_URL=$(heroku create --json | grep -o '"web_url":"[^"]*' | cut -d'"' -f4)
    APP_NAME=$(echo $APP_URL | sed 's/https:\/\///' | sed 's/.herokuapp.com//')
else
    echo "📦 Creating Heroku app: $APP_NAME..."
    heroku create $APP_NAME
fi

echo "✅ App created: https://$APP_NAME.herokuapp.com"
echo ""

# Add PostgreSQL
echo "🐘 Adding PostgreSQL database..."
heroku addons:create heroku-postgresql:mini -a $APP_NAME
echo "✅ PostgreSQL added"
echo ""

# Add Redis
echo "🔴 Adding Redis cache..."
heroku addons:create heroku-redis:mini -a $APP_NAME
echo "✅ Redis added"
echo ""

# Set required environment variables
echo "🔧 Setting environment variables..."

# JWT Secret
JWT_SECRET=$(openssl rand -base64 32)
heroku config:set JWT_SECRET="$JWT_SECRET" -a $APP_NAME
echo "✅ JWT_SECRET set"

# Node Environment
heroku config:set NODE_ENV=production -a $APP_NAME
echo "✅ NODE_ENV set to production"

# Ask for API keys
echo ""
echo "📋 Please provide your API keys:"
echo ""

read -p "Anthropic API Key: " ANTHROPIC_KEY
if [ ! -z "$ANTHROPIC_KEY" ]; then
    heroku config:set ANTHROPIC_API_KEY="$ANTHROPIC_KEY" -a $APP_NAME
    echo "✅ ANTHROPIC_API_KEY set"
fi

read -p "Google OAuth Client ID: " GOOGLE_CLIENT_ID
if [ ! -z "$GOOGLE_CLIENT_ID" ]; then
    heroku config:set GOOGLE_OAUTH_CLIENT_ID="$GOOGLE_CLIENT_ID" -a $APP_NAME
    echo "✅ GOOGLE_OAUTH_CLIENT_ID set"
fi

read -p "Google OAuth Client Secret: " GOOGLE_CLIENT_SECRET
if [ ! -z "$GOOGLE_CLIENT_SECRET" ]; then
    heroku config:set GOOGLE_OAUTH_CLIENT_SECRET="$GOOGLE_CLIENT_SECRET" -a $APP_NAME
    echo "✅ GOOGLE_OAUTH_CLIENT_SECRET set"
fi

# Set redirect URI
REDIRECT_URI="https://$APP_NAME.herokuapp.com/api/oauth/google-sheets/callback"
heroku config:set GOOGLE_OAUTH_REDIRECT_URI="$REDIRECT_URI" -a $APP_NAME
echo "✅ GOOGLE_OAUTH_REDIRECT_URI set to: $REDIRECT_URI"

echo ""
echo "⚠️  IMPORTANT: Update Google Cloud Console with this redirect URI:"
echo "   $REDIRECT_URI"
echo ""

# Optional: Meta credentials
read -p "Meta App ID (optional, press Enter to skip): " META_APP_ID
if [ ! -z "$META_APP_ID" ]; then
    heroku config:set META_APP_ID="$META_APP_ID" -a $APP_NAME
    read -p "Meta App Secret: " META_APP_SECRET
    heroku config:set META_APP_SECRET="$META_APP_SECRET" -a $APP_NAME
    echo "✅ Meta credentials set"
fi

echo ""
echo "🚢 Deploying to Heroku..."
git push heroku main

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Application URL: https://$APP_NAME.herokuapp.com"
echo "🔍 View logs: heroku logs --tail -a $APP_NAME"
echo "🗄️  Database: heroku pg:psql -a $APP_NAME"
echo "🔴 Redis: heroku redis:cli -a $APP_NAME"
echo ""
echo "🎉 Your application is now live!"
echo ""
echo "Next steps:"
echo "1. Visit: https://$APP_NAME.herokuapp.com"
echo "2. Update Google Cloud Console redirect URI"
echo "3. Test the application"
echo ""
