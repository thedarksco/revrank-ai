# OAuth Setup Guide

## Your Current OAuth Configuration

### Google Cloud Console
- **Client ID**: `511813909081-9ob7rm90dosc5e9qq2n0vgmugcvf6stc.apps.googleusercontent.com`
- **Client Secret**: You need to find this!

### How to Find Your Client Secret:

1. **Method 1 - Download JSON**:
   - Go to: https://console.cloud.google.com/apis/credentials
   - Find your OAuth client in the list
   - Click the download button (↓) on the right
   - Open the downloaded JSON file
   - Look for `"client_secret": "GOCSPX-..."`

2. **Method 2 - View in Console**:
   - On your current page, scroll down
   - Look for a section labeled "Client secret"
   - If hidden, click "Show" or the eye icon
   - Copy the value (starts with GOCSPX-)

3. **Method 3 - Reset Secret** (if you can't find it):
   - Click "Reset secret" button if available
   - This will generate a new secret
   - Update it in both Supabase and .env.local

### Required Updates:

Once you have the Client Secret, update it in:

1. **Supabase Dashboard**:
   - https://supabase.com/dashboard/project/pofwmancpflmmsosqzxi/auth/providers
   - Click Google provider
   - Update Client Secret field
   - Click Save

2. **Your .env.local file**:
   - Update line: `GOOGLE_CLIENT_SECRET=YOUR_NEW_SECRET_HERE`

3. **Clear all browser data and try again**

### Authorized Redirect URIs (Already Configured):
- ✅ https://pofwmancpflmmsosqzxi.supabase.co/auth/v1/callback
- ✅ http://localhost:3000/auth/callback
- ✅ https://revrank-ai.vercel.app/auth/callback