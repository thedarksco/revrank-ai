# Multi-Account Google Business Profile Implementation

## Overview

This implementation adds comprehensive support for managing multiple Google accounts and Google Business Profile manager accounts within RevRank.ai. Users can now connect multiple Google accounts, select specific accounts for different clients, and manage complex GBP account hierarchies.

## Key Features

### 1. Multiple Google Account Support
- **Account Storage**: Each user can connect multiple Google accounts
- **Account Types**: Support for standard, G Suite, and manager accounts
- **Account Metadata**: Store account info (email, name, picture, domain)
- **Account Status**: Track connection status and last activity

### 2. Manager Account Discovery
- **API Integration**: Uses Google My Business Account Management API
- **Hierarchy Mapping**: Maps manager accounts to location accounts
- **Role Tracking**: Tracks user roles (OWNER, MANAGER, SITE_MANAGER)
- **Automatic Sync**: Discovers and caches account relationships

### 3. Enhanced OAuth Flow
- **Account Selection**: Force account picker during OAuth
- **Domain Filtering**: Support for G Suite domain hints
- **State Management**: Enhanced state tracking for complex flows
- **User Info Collection**: Collect account details during authorization

### 4. Per-Account Token Management
- **Isolated Tokens**: Tokens are stored per Google account
- **Automatic Refresh**: Background token refresh for multiple accounts
- **Secure Storage**: Encrypted token storage with RLS
- **Scope Management**: Track scopes per account

## Database Schema Changes

### New Tables

#### `google_accounts`
```sql
CREATE TABLE public.google_accounts (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES profiles(id),
    google_account_id TEXT NOT NULL,
    email TEXT NOT NULL,
    name TEXT,
    picture_url TEXT,
    account_type TEXT DEFAULT 'standard',
    hosted_domain TEXT,
    is_manager BOOLEAN DEFAULT false,
    managed_accounts TEXT[],
    is_active BOOLEAN DEFAULT true,
    last_connected TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, google_account_id)
);
```

#### `gbp_managers`
```sql
CREATE TABLE public.gbp_managers (
    id UUID PRIMARY KEY,
    google_account_id UUID REFERENCES google_accounts(id),
    manager_account_name TEXT,
    manager_account_id TEXT NOT NULL,
    account_role TEXT,
    location_account_name TEXT,
    location_account_id TEXT NOT NULL,
    location_place_id TEXT,
    is_active BOOLEAN DEFAULT true,
    last_synced TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(google_account_id, manager_account_id, location_account_id)
);
```

### Modified Tables

#### `clients`
- Added `google_account_id` - References specific Google account
- Added `gbp_manager_id` - References specific manager relationship

#### `google_tokens`
- Added `google_account_id` - Links tokens to specific accounts
- Removed dependency on `client_id`

## API Endpoints

### Google Account Management
- `GET /api/google/accounts` - List connected Google accounts
- `POST /api/google/accounts` - Add/update Google account

### Manager Account Discovery
- `GET /api/google/managers?googleAccountId={id}` - Discover manager accounts
- `POST /api/google/managers` - Update manager relationship

### Account Selection
- `GET /api/gbp/select-account?clientId={id}` - Get selection options
- `POST /api/gbp/select-account` - Select account for client

### Enhanced OAuth
- `GET /api/gbp/auth?clientId={id}&accountSelection=true&hd={domain}`
- `GET /api/gbp/callback` - Enhanced callback with account info

### Manager Connection
- `POST /api/gbp/connect-manager` - Connect client to specific manager account

## UI Components

### 1. Google Account Manager (`/dashboard/GoogleAccountManager.tsx`)
- **Account List**: Shows all connected accounts
- **Account Details**: Displays account info and manager relationships
- **Sync Controls**: Manual sync for manager accounts
- **Add Account**: Connect new Google accounts

### 2. Enhanced GBP Connection Button (`/clients/[id]/GBPConnectionButton.tsx`)
- **Account Selector Modal**: Choose from connected accounts
- **Current Account Display**: Show connected account info
- **Switch Account**: Change account for existing connections
- **Add New Account**: Connect additional accounts

## Usage Flow

### 1. Initial Setup
1. User connects first Google account through OAuth
2. Account info is stored in `google_accounts` table
3. If manager account, system discovers managed locations
4. Relationships stored in `gbp_managers` table

### 2. Adding Additional Accounts
1. User clicks "Add Account" in dashboard or during client setup
2. OAuth flow includes `accountSelection=true` parameter
3. Google shows account picker
4. New account is stored and manager relationships discovered

### 3. Client Connection
1. User creates new client or edits existing client
2. System shows available Google accounts
3. User selects specific account for this client
4. Client is associated with chosen account and manager relationship

### 4. Manager Account Usage
1. For manager accounts, system shows available locations
2. User can connect client to specific location
3. All GBP operations use the selected manager/location context

## Migration Strategy

### Existing Data Migration
```sql
-- Run migration script to move existing data
SELECT migrate_existing_google_data();
```

### Steps:
1. Create new tables
2. Add new columns to existing tables
3. Migrate existing `google_tokens` data to new structure
4. Update client associations
5. Clean up old columns (optional)

## Security Considerations

### Row-Level Security (RLS)
- All new tables have RLS enabled
- Users can only access their own accounts and relationships
- Policies enforce user ownership at database level

### Token Security
- Tokens remain encrypted in storage
- Each account has isolated token storage
- Automatic cleanup of unused tokens

### API Security
- All endpoints require authentication
- User ownership validation for all operations
- Input validation and sanitization

## Configuration

### Environment Variables
No additional environment variables required. Uses existing:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXT_PUBLIC_APP_URL`

### Google Cloud Console Setup
Ensure OAuth client has these redirect URIs:
- `https://revrank-ai.vercel.app/api/gbp/callback`
- `http://localhost:3000/api/gbp/callback`

Required API scopes:
- `https://www.googleapis.com/auth/business.manage`
- `https://www.googleapis.com/auth/businesscommunications`
- `https://www.googleapis.com/auth/plus.business.manage`

Required APIs:
- My Business Business Information API
- My Business Account Management API
- My Business Notifications API

## Testing

Run the test script to validate implementation:
```bash
node scripts/test-multi-account.js
```

## Deployment

### 1. Database Migration
```sql
-- Run in Supabase SQL Editor
\i supabase/migrations/003_multi_account_support.sql
```

### 2. Application Deployment
```bash
npm run build
vercel --prod
```

### 3. Verification
1. Check dashboard shows Google Account Manager
2. Test connecting multiple Google accounts
3. Verify account selection during client setup
4. Test manager account discovery

## Troubleshooting

### Common Issues

1. **OAuth "Access blocked" error**
   - Verify OAuth consent screen configuration
   - Check test user permissions
   - Ensure app is published or user is added as test user

2. **"Invalid scope" error**
   - Enable required APIs in Google Cloud Console
   - Update OAuth consent screen with required scopes

3. **Token refresh failures**
   - Check Google client credentials
   - Verify refresh token storage
   - Monitor token expiration handling

4. **Manager account not discovered**
   - Verify account has manager permissions
   - Check API rate limits
   - Review manager account API responses

### Debug Endpoints

Use these for debugging:
- `GET /api/auth/debug` - Check auth status
- Browser DevTools Network tab for API calls
- Supabase dashboard for database inspection

## Future Enhancements

### Planned Features
1. **Bulk Account Import**: CSV import for multiple accounts
2. **Account Health Monitoring**: Track token status and API limits
3. **Advanced Permissions**: Granular permission management
4. **Account Groups**: Organize accounts by business units
5. **Automated Sync**: Scheduled sync of manager relationships

### Performance Optimizations
1. **Caching**: Cache manager relationships
2. **Background Jobs**: Async token refresh
3. **Rate Limiting**: Implement API rate limiting
4. **Batch Operations**: Bulk account operations

This implementation provides a solid foundation for managing complex Google Business Profile account hierarchies while maintaining security, performance, and user experience standards.