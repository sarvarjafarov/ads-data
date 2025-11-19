# Meta Ads OAuth Setup Guide

This guide will help you set up Meta Ads OAuth integration for the AdsData platform.

## Step 1: Create a Meta Developer Account

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Click **"Get Started"** or **"My Apps"** in the top right
3. Log in with your Facebook account
4. Accept the terms and conditions if prompted

## Step 2: Create a New App

1. Click **"Create App"** button
2. Select **"Business"** as the app type
3. Fill in the app details:
   - **App Name**: AdsData Platform (or your preferred name)
   - **App Contact Email**: Your email address
   - **Business Account**: Select your business account (or create one)
4. Click **"Create App"**

## Step 3: Add Marketing API Product

1. In your app dashboard, scroll down to **"Add Products to Your App"**
2. Find **"Marketing API"** and click **"Set Up"**
3. This will add the Marketing API to your app

## Step 4: Get Your App Credentials

1. In the left sidebar, click **"Settings"** → **"Basic"**
2. You'll see:
   - **App ID** - This is your `META_APP_ID`
   - **App Secret** - Click **"Show"** to reveal, this is your `META_APP_SECRET`
3. **Important**: Keep your App Secret confidential!

## Step 5: Configure OAuth Settings

1. In the left sidebar, go to **"Marketing API"** → **"Tools"**
2. Scroll to **"Valid OAuth Redirect URIs"**
3. Add your callback URL:
   ```
   http://localhost:3000/api/oauth/meta/callback
   ```
4. For production, also add:
   ```
   https://yourdomain.com/api/oauth/meta/callback
   ```
5. Click **"Save Changes"**

## Step 6: Request Advanced Access (Important!)

By default, your app has **Standard Access** which limits you to development mode. To access real ad accounts:

1. Go to **"App Review"** → **"Permissions and Features"**
2. Find and request these permissions:
   - `ads_read` - Read ads data
   - `ads_management` - Manage ads
   - `business_management` - Access business assets
   - `read_insights` - Read ad insights/metrics
3. Follow Meta's verification process for each permission
4. This may require:
   - Business verification
   - App review submission
   - Explaining your use case

**Note**: During development, you can test with your own ad accounts without Advanced Access.

## Step 7: Add Test Users (For Development)

1. Go to **"Roles"** → **"Test Users"**
2. Add developers who need to test the integration
3. These users can connect their ad accounts without Advanced Access

## Step 8: Update Environment Variables

1. Open your `.env` file in the project root
2. Add your credentials:

```env
# Meta Ads OAuth
META_APP_ID=your_app_id_here
META_APP_SECRET=your_app_secret_here
META_REDIRECT_URI=http://localhost:3000/api/oauth/meta/callback
```

3. **Important**: Never commit your `.env` file to git!

## Step 9: Restart Your Server

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

## Step 10: Test the Connection

1. Navigate to: http://localhost:3000/dashboard
2. Click **"Connect Meta Ads"**
3. You'll be redirected to Meta to authorize the app
4. After authorization, you'll be redirected back with your ad accounts connected

## Troubleshooting

### "App Not Set Up" Error
- Make sure you've added the Marketing API product to your app
- Verify the redirect URI matches exactly (including http/https)

### "Invalid OAuth Redirect URI"
- Check that you've added the redirect URI in Meta app settings
- Ensure there are no trailing slashes or typos

### "This App is in Development Mode"
- Your app can only be used by:
  - App administrators
  - App developers
  - App testers
- Add team members in **Roles** section
- For production access, submit for App Review

### "Insufficient Permissions"
- Request Advanced Access for required permissions
- During development, ensure test users have access to ad accounts

### Can't See Ad Accounts
- Make sure the Meta user has access to the ad accounts in Business Manager
- Verify you've granted all requested permissions during OAuth flow

## Production Checklist

Before going live:

- [ ] Request and receive Advanced Access for all required permissions
- [ ] Complete Business Verification
- [ ] Update redirect URI to production domain
- [ ] Set up proper app icon and privacy policy
- [ ] Test with multiple ad accounts
- [ ] Implement proper error handling and logging
- [ ] Set up monitoring for OAuth token expiration
- [ ] Review Meta's Platform Terms and Policies

## Useful Links

- [Meta for Developers](https://developers.facebook.com/)
- [Marketing API Documentation](https://developers.facebook.com/docs/marketing-apis)
- [OAuth Documentation](https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow)
- [Business Manager](https://business.facebook.com/)
- [App Review Process](https://developers.facebook.com/docs/app-review)

## Support

For issues with this integration:
1. Check the server logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test the OAuth flow in Meta's OAuth Playground
4. Check Meta's Platform Status for any outages

For Meta-specific issues:
- [Meta Developer Community](https://developers.facebook.com/community/)
- [Meta Business Help Center](https://www.facebook.com/business/help)
