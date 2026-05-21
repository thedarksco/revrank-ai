# Google Cloud Console Setup for RevRank.ai

## Required OAuth Configuration

### 1. Go to Google Cloud Console
Visit: https://console.cloud.google.com/apis/credentials

### 2. OAuth 2.0 Client ID Settings

Select your OAuth 2.0 Client ID and configure the following:

#### Authorized JavaScript origins
Add these origins:
- `https://revrank-ai.vercel.app`
- `http://localhost:3000` (for local development)

#### Authorized redirect URIs
**IMPORTANT**: These must match EXACTLY (no trailing slashes):
- `https://revrank-ai.vercel.app/api/gbp/callback`
- `http://localhost:3000/api/gbp/callback`

### 3. Enable Required APIs

Go to the [API Library](https://console.cloud.google.com/apis/library) and enable:

1. **My Business Business Information API**
   - Search for "My Business Business Information API"
   - Click Enable

2. **My Business Account Management API**
   - Search for "My Business Account Management API"
   - Click Enable

3. **My Business Notifications API**
   - Search for "My Business Notifications API"
   - Click Enable

### 4. OAuth Consent Screen

Go to [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)

#### Required Scopes
Add these OAuth scopes:
- `https://www.googleapis.com/auth/business.manage`
- `https://www.googleapis.com/auth/businesscommunications`
- `https://www.googleapis.com/auth/plus.business.manage`

#### Test Users (if in Testing mode)
Add the email addresses that will be testing the application:
- hello@revrank.ai
- (add other test user emails)

### 5. Verify Configuration

After setup, verify:
1. ✅ OAuth Client ID has both redirect URIs listed above
2. ✅ All three My Business APIs are enabled
3. ✅ OAuth consent screen has the required scopes
4. ✅ Test users are added (if in testing mode)

### Common Issues & Solutions

#### "redirect_uri_mismatch" Error
- Ensure redirect URIs match EXACTLY as shown above
- No trailing slashes
- Check for https vs http
- Production must use: `https://revrank-ai.vercel.app/api/gbp/callback`

#### "Access blocked" Error
- Verify OAuth consent screen is configured
- Add test users if app is in testing mode
- Consider publishing the app for production use

#### "Invalid scope" Error
- Enable all required APIs listed above
- Add scopes to OAuth consent screen

### Environment Variables

Ensure these are set in your application:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
```

In Vercel, these should be added as environment variables for the production environment.

### Testing the Connection

1. Go to https://revrank-ai.vercel.app/dashboard
2. Click "Connect Google Account"
3. You should be redirected to Google's OAuth consent screen
4. After authorization, you'll be redirected back to the dashboard

If you encounter any errors, check:
- Browser Developer Console for error messages
- Network tab for failed requests
- Verify all URIs match exactly as configured