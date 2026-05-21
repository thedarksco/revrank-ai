# Google Business Profile OAuth Setup

## Required Google Cloud Console Configuration

To enable Google Business Profile management, you need to update your OAuth client configuration:

### 1. Enable Required APIs

Go to the [Google Cloud Console API Library](https://console.cloud.google.com/apis/library) and enable:
- **My Business Business Information API**
- **My Business Account Management API**
- **My Business Notifications API**
- **Google+ API** (for legacy support)

### 2. Update OAuth Consent Screen

1. Go to [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. Add these scopes:
   - `../auth/business.manage` - Manage Google Business Profile
   - `../auth/businesscommunications` - Business communications
   - `../auth/plus.business.manage` - Legacy business management

### 3. Add Redirect URIs

In your OAuth 2.0 Client ID settings, add these **Authorized redirect URIs**:
- `https://revrank-ai.vercel.app/api/gbp/callback`
- `http://localhost:3000/api/gbp/callback` (for local development)

### 4. Testing the Integration

1. Add a client in the RevRank.ai dashboard
2. Go to the client detail page
3. Click "Connect Google Business Profile"
4. Authorize access to the GBP account
5. You'll be redirected back with the connection established

## How It Works

1. **Connect Flow**:
   - User clicks "Connect Google Business Profile" on client page
   - Redirected to Google OAuth with GBP-specific scopes
   - User authorizes access to their GBP account
   - Tokens are stored encrypted in the database
   - Client marked as GBP connected

2. **Disconnect Flow**:
   - User clicks "Disconnect" on client page
   - Tokens are deleted from database
   - Client marked as disconnected

3. **Token Management**:
   - Access tokens are automatically refreshed when expired
   - Refresh tokens are stored securely
   - Tokens are scoped per client, not per user

## Security Notes

- Tokens are stored encrypted in Supabase
- Row-level security ensures users can only access their own clients' tokens
- Refresh tokens allow long-term access without repeated authorization
- Each client requires separate authorization for security isolation

## Troubleshooting

### "Access blocked" error
- Make sure the OAuth consent screen is configured
- Verify the app is in testing or production mode
- Check that the user's email is added as a test user (if in testing mode)

### "Invalid scope" error
- Enable the required APIs in Google Cloud Console
- Update the OAuth consent screen with the required scopes

### "Redirect URI mismatch" error
- Verify the callback URLs match exactly (no trailing slashes)
- Check both local and production URLs are added

### Token exchange fails
- Verify Client ID and Client Secret match in both Google Console and environment variables
- Check that the redirect URI in the request matches the one in Google Console exactly