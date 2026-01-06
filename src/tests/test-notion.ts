import 'dotenv/config';
import { Client } from '@notionhq/client';
import type { PageObjectResponse, PartialPageObjectResponse, DatabaseObjectResponse, DataSourceObjectResponse } from '@notionhq/client/build/src/api-endpoints.js';

const notion = new Client({ auth: process.env.NOTION_TOKEN });

console.log('🧪 Notion API Connection Test\n');
console.log('='.repeat(50));

interface TestResults {
  envVars?: boolean;
  auth?: boolean;
  dbAccess?: boolean;
  dbQuery?: boolean;
  createCapability?: boolean;
}

// Helper to check if result is a full page
function isFullPage(page: PageObjectResponse | PartialPageObjectResponse): page is PageObjectResponse {
  return 'properties' in page;
}

// Check environment variables
function checkEnvVars(): boolean {
  console.log('\n📋 Checking environment variables...\n');

  const vars: Record<string, string | undefined> = {
    NOTION_TOKEN: process.env.NOTION_TOKEN,
    NOTION_DATABASE_ID: process.env.NOTION_DATABASE_ID,
    NOTION_DATA_SOURCE_ID: process.env.NOTION_DATA_SOURCE_ID
  };

  let allPresent = true;

  for (const [name, value] of Object.entries(vars)) {
    if (value) {
      const masked = value.slice(0, 8) + '...' + value.slice(-4);
      console.log(`  ✅ ${name}: ${masked}`);
    } else if (name === 'NOTION_DATA_SOURCE_ID') {
      console.log(`  ⚠️  ${name}: Not set (REQUIRED for API 2025-09-03)`);
      console.log(`     → Get it by calling GET /v1/databases/{database_id}`);
      allPresent = false;
    } else {
      console.log(`  ❌ ${name}: Missing`);
      allPresent = false;
    }
  }

  return allPresent;
}

// Test basic authentication
async function testAuth(): Promise<boolean> {
  console.log('\n🔐 Testing authentication...\n');

  try {
    const response = await notion.users.me({});
    console.log(`  ✅ Authenticated as: ${response.name || response.id}`);
    console.log(`  ✅ Bot type: ${response.type}`);
    return true;
  } catch (error) {
    const err = error as Error;
    console.log(`  ❌ Authentication failed: ${err.message}`);
    return false;
  }
}

// Test database access
async function testDatabaseAccess(): Promise<boolean> {
  console.log('\n📊 Testing database access...\n');

  const databaseId = process.env.NOTION_DATABASE_ID;
  const dataSourceId = process.env.NOTION_DATA_SOURCE_ID;

  if (!databaseId) {
    console.log('  ❌ NOTION_DATABASE_ID not set');
    return false;
  }

  try {
    const database = await notion.databases.retrieve({ database_id: databaseId }) as DatabaseObjectResponse;
    console.log(`  ✅ Database found: ${database.title?.[0]?.plain_text || 'Untitled'}`);

    // Check for data_sources (new API)
    if (database.data_sources && database.data_sources.length > 0) {
      console.log(`  ✅ Data sources available:`);
      database.data_sources.forEach(ds => {
        console.log(`     - ID: ${ds.id}`);
        console.log(`       Name: ${ds.name || 'N/A'}`);
      });

      // Check if configured data source ID matches
      if (dataSourceId) {
        const match = database.data_sources.find(ds => ds.id === dataSourceId);
        if (match) {
          console.log(`  ✅ NOTION_DATA_SOURCE_ID matches database`);
        } else {
          console.log(`  ⚠️  NOTION_DATA_SOURCE_ID doesn't match any data source in database`);
        }
      }
    } else {
      console.log('  ⚠️  No data_sources in response');
    }

    // Get properties from data source (new API structure)
    if (dataSourceId) {
      try {
        const dataSource = await notion.dataSources.retrieve({ data_source_id: dataSourceId }) as DataSourceObjectResponse;
        console.log('\n  📝 Data source properties:');
        for (const [name, prop] of Object.entries(dataSource.properties)) {
          console.log(`     - ${name} (${prop.type})`);
        }
      } catch {
        console.log('\n  ⚠️  Could not retrieve data source properties');
      }
    }

    return true;
  } catch (error) {
    const err = error as Error & { code?: string };
    console.log(`  ❌ Database access failed: ${err.message}`);
    if (err.code === 'object_not_found') {
      console.log('     → Make sure the database is shared with your integration');
    }
    return false;
  }
}

// Test database query using dataSources.query (new API)
async function testDatabaseQuery(): Promise<boolean> {
  console.log('\n🔍 Testing data source query...\n');

  const dataSourceId = process.env.NOTION_DATA_SOURCE_ID;

  if (!dataSourceId) {
    console.log('  ❌ NOTION_DATA_SOURCE_ID not set');
    console.log('     → Get it from the database retrieve response');
    return false;
  }

  try {
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      page_size: 5
    });

    console.log(`  ✅ Query successful`);
    console.log(`  ✅ Found ${response.results.length} bug(s)`);

    if (response.results.length > 0) {
      console.log('\n  📋 Recent bugs:');
      response.results
        .filter((page): page is PageObjectResponse => isFullPage(page as PageObjectResponse | PartialPageObjectResponse))
        .forEach((page, i) => {
          const props = page.properties as Record<string, {
            title?: Array<{ text?: { content: string } }>;
            unique_id?: { number: number };
            status?: { name: string };
          }>;
          const title = props['Title']?.title?.[0]?.text?.content || 'Untitled';
          const bugId = props['Bug ID']?.unique_id?.number ?? 'N/A';
          const status = props['Status']?.status?.name || 'Unknown';
          console.log(`     ${i + 1}. [#${bugId}] ${title} (${status})`);
        });
    }

    return true;
  } catch (error) {
    const err = error as Error;
    console.log(`  ❌ Query failed: ${err.message}`);
    return false;
  }
}

// Test creating a page (dry run info)
async function testCreateCapability(): Promise<boolean> {
  console.log('\n✏️  Testing create capability...\n');

  const dataSourceId = process.env.NOTION_DATA_SOURCE_ID;

  if (!dataSourceId) {
    console.log('  ❌ NOTION_DATA_SOURCE_ID not set');
    return false;
  }

  try {
    // We'll create a test bug and immediately archive it
    const response = await notion.pages.create({
      parent: { data_source_id: dataSourceId },
      properties: {
        'Title': {
          title: [{ text: { content: '🧪 Test Bug (Auto-delete)' } }]
        },
        'Description': {
          rich_text: [{ text: { content: 'This is a test bug created by the test script. It will be archived.' } }]
        },
        'Status': {
          status: { name: 'Open' }
        },
        'Severity': {
          select: { name: 'Low' }
        },
        'Priority': {
          select: { name: 'Low' }
        },
        'Date Created': {
          date: { start: new Date().toISOString().split('T')[0] }
        }
      }
    });

    console.log(`  ✅ Test bug created successfully`);

    // Archive the test page
    await notion.pages.update({
      page_id: response.id,
      archived: true
    });

    console.log(`  ✅ Test bug archived (cleaned up)`);
    return true;
  } catch (error) {
    const err = error as Error;
    console.log(`  ❌ Create failed: ${err.message}`);

    if (err.message.includes('property')) {
      console.log('     → Check that your database has the required properties:');
      console.log('       Title, Description, Status, Severity, Priority, Date Created');
    }

    return false;
  }
}

// Run all tests
async function runTests(): Promise<void> {
  const results: TestResults = {};

  results.envVars = checkEnvVars();

  if (results.envVars) {
    results.auth = await testAuth();

    if (results.auth) {
      results.dbAccess = await testDatabaseAccess();
      results.dbQuery = await testDatabaseQuery();
      results.createCapability = await testCreateCapability();
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary\n');

  const tests: Array<[string, boolean | undefined]> = [
    ['Environment Variables', results.envVars],
    ['Authentication', results.auth],
    ['Database Access', results.dbAccess],
    ['Data Source Query', results.dbQuery],
    ['Create Capability', results.createCapability]
  ];

  let passed = 0;
  let failed = 0;

  for (const [name, result] of tests) {
    if (result === true) {
      console.log(`  ✅ ${name}`);
      passed++;
    } else if (result === false) {
      console.log(`  ❌ ${name}`);
      failed++;
    } else {
      console.log(`  ⏭️  ${name} (skipped)`);
    }
  }

  console.log(`\n  Total: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('\n❌ Unexpected error:', (error as Error).message);
  process.exit(1);
});
