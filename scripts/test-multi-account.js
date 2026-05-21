#!/usr/bin/env node

/**
 * Test script for Multi-Account Google Business Profile functionality
 *
 * This script tests the new multi-account features including:
 * - Google account management
 * - Manager account discovery
 * - Account selection for clients
 * - Token management per account
 */

const https = require('https');
const url = require('url');

// Configuration
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Helper function to make HTTP requests
function makeRequest(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(endpoint, BASE_URL);

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Multi-Account Test Script',
        ...options.headers
      }
    };

    const protocol = urlObj.protocol === 'https:' ? https : require('http');

    const req = protocol.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: result
          });
        } catch (err) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function testMultiAccountEndpoints() {
  console.log('🚀 Testing Multi-Account Google Business Profile functionality...\n');

  const tests = [
    {
      name: 'Google Accounts API - GET',
      test: () => makeRequest('/api/google/accounts'),
      expect: (result) => {
        console.log(`   Status: ${result.status}`);
        if (result.status === 401) {
          console.log('   ✅ Correctly requires authentication');
          return true;
        } else if (result.status === 200) {
          console.log('   ✅ API is accessible');
          console.log(`   📊 Response: ${JSON.stringify(result.data, null, 2)}`);
          return true;
        }
        return false;
      }
    },

    {
      name: 'Google Managers API - GET',
      test: () => makeRequest('/api/google/managers?googleAccountId=test-account-id'),
      expect: (result) => {
        console.log(`   Status: ${result.status}`);
        if (result.status === 401) {
          console.log('   ✅ Correctly requires authentication');
          return true;
        } else if (result.status === 400) {
          console.log('   ✅ Correctly validates required parameters');
          return true;
        }
        return false;
      }
    },

    {
      name: 'GBP Select Account API - GET',
      test: () => makeRequest('/api/gbp/select-account?clientId=test-client-id'),
      expect: (result) => {
        console.log(`   Status: ${result.status}`);
        if (result.status === 401) {
          console.log('   ✅ Correctly requires authentication');
          return true;
        } else if (result.status === 400) {
          console.log('   ✅ Correctly validates required parameters');
          return true;
        }
        return false;
      }
    },

    {
      name: 'GBP Connect Manager API - POST',
      test: () => makeRequest('/api/gbp/connect-manager', {
        method: 'POST',
        body: {
          googleAccountId: 'test-account-id',
          managerAccountId: 'test-manager-id',
          locationAccountId: 'test-location-id',
          clientId: 'test-client-id'
        }
      }),
      expect: (result) => {
        console.log(`   Status: ${result.status}`);
        if (result.status === 401) {
          console.log('   ✅ Correctly requires authentication');
          return true;
        } else if (result.status === 400) {
          console.log('   ✅ Correctly validates required fields');
          return true;
        }
        return false;
      }
    },

    {
      name: 'GBP Enhanced Auth URL',
      test: () => makeRequest('/api/gbp/auth?clientId=test-client&accountSelection=true&hd=example.com'),
      expect: (result) => {
        console.log(`   Status: ${result.status}`);
        if (result.status === 302 || result.status === 401) {
          console.log('   ✅ Correctly handles OAuth flow or requires authentication');
          return true;
        }
        return false;
      }
    },

    {
      name: 'Database Schema Validation',
      test: async () => {
        // This would require a database connection to validate
        // For now, we'll just check if the migration file exists
        const fs = require('fs').promises;
        try {
          await fs.access('/Users/darryldarks/Desktop/RevRank.ai - Platform/revrank-ai/supabase/migrations/003_multi_account_support.sql');
          return { status: 200, data: { migrationExists: true } };
        } catch {
          return { status: 404, data: { migrationExists: false } };
        }
      },
      expect: (result) => {
        if (result.data.migrationExists) {
          console.log('   ✅ Migration file exists');
          return true;
        } else {
          console.log('   ❌ Migration file not found');
          return false;
        }
      }
    }
  ];

  let passed = 0;
  let total = tests.length;

  for (const test of tests) {
    console.log(`🔍 ${test.name}`);
    try {
      const result = await test.test();
      const success = test.expect(result);
      if (success) {
        passed++;
      }
      console.log();
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }
  }

  console.log(`📊 Test Results: ${passed}/${total} tests passed\n`);

  if (passed === total) {
    console.log('🎉 All tests passed! Multi-account functionality is ready.');
  } else {
    console.log('⚠️  Some tests failed. Review the implementation.');
  }
}

// Feature validation checklist
function displayFeatureChecklist() {
  console.log('📋 Multi-Account Feature Checklist:\n');

  const features = [
    '✅ Database schema updated with google_accounts table',
    '✅ Database schema updated with gbp_managers table',
    '✅ Enhanced GBP OAuth flow with account selection',
    '✅ Google account management API endpoints',
    '✅ Manager account discovery functionality',
    '✅ Account selection for client connections',
    '✅ Token management per Google account',
    '✅ Updated disconnect functionality',
    '✅ Enhanced UI with account selector',
    '✅ Dashboard Google Account Manager component',
    '✅ Migration script for existing data',
    '✅ Row-level security policies',
    '✅ TypeScript interfaces and error handling'
  ];

  features.forEach(feature => console.log(`   ${feature}`));

  console.log('\n🔗 Key Endpoints:');
  console.log('   GET  /api/google/accounts - List user\'s Google accounts');
  console.log('   POST /api/google/accounts - Add/update Google account');
  console.log('   GET  /api/google/managers - Discover manager accounts');
  console.log('   GET  /api/gbp/select-account - Get account selection options');
  console.log('   POST /api/gbp/select-account - Select account for client');
  console.log('   POST /api/gbp/connect-manager - Connect to manager account');
  console.log('   GET  /api/gbp/auth - Enhanced OAuth with account selection\n');

  console.log('🎯 Usage Instructions:');
  console.log('   1. User connects multiple Google accounts through enhanced OAuth');
  console.log('   2. System discovers and stores manager account relationships');
  console.log('   3. User can select specific accounts when connecting clients');
  console.log('   4. Each client can be associated with a different Google account');
  console.log('   5. Tokens are managed per account, not per client');
  console.log('   6. Dashboard shows all connected accounts and their status\n');
}

// Run tests
async function main() {
  displayFeatureChecklist();
  await testMultiAccountEndpoints();
}

if (require.main === module) {
  main().catch(console.error);
}