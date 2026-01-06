import 'dotenv/config';
import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });

console.log('🧪 Notion API Connection Test\n');
console.log('='.repeat(50));

// Check environment variables
function checkEnvVars() {
  console.log('\n📋 Checking environment variables...\n');

  const vars = {
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
      console.log(`  ⚠️  ${name}: Not set (may be required for API 2025-09-03)`);
    } else {
      console.log(`  ❌ ${name}: Missing`);
      allPresent = false;
    }
  }

  return allPresent;
}

// Test basic authentication
async function testAuth() {
  console.log('\n🔐 Testing authentication...\n');

  try {
    const response = await notion.users.me();
    console.log(`  ✅ Authenticated as: ${response.name || response.id}`);
    console.log(`  ✅ Bot type: ${response.type}`);
    return true;
  } catch (error) {
    console.log(`  ❌ Authentication failed: ${error.message}`);
    return false;
  }
}

// Test database access
async function testDatabaseAccess() {
  console.log('\n📊 Testing database access...\n');

  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!databaseId) {
    console.log('  ❌ NOTION_DATABASE_ID not set');
    return false;
  }

  try {
    const database = await notion.databases.retrieve({ database_id: databaseId });
    console.log(`  ✅ Database found: ${database.title?.[0]?.plain_text || 'Untitled'}`);

    // Check for data_sources (new API)
    if (database.data_sources) {
      console.log(`  ✅ Data sources available:`);
      database.data_sources.forEach(ds => {
        console.log(`     - ID: ${ds.id}`);
        console.log(`       Name: ${ds.name || 'N/A'}`);
      });
    } else {
      console.log('  ⚠️  No data_sources in response (may need API version 2025-09-03)');
    }

    // List properties
    console.log('\n  📝 Database properties:');
    for (const [name, prop] of Object.entries(database.properties)) {
      console.log(`     - ${name} (${prop.type})`);
    }

    return true;
  } catch (error) {
    console.log(`  ❌ Database access failed: ${error.message}`);
    if (error.code === 'object_not_found') {
      console.log('     → Make sure the database is shared with your integration');
    }
    return false;
  }
}

// Test database query
async function testDatabaseQuery() {
  console.log('\n🔍 Testing database query...\n');

  const databaseId = process.env.NOTION_DATABASE_ID;

  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      page_size: 5
    });

    console.log(`  ✅ Query successful`);
    console.log(`  ✅ Found ${response.results.length} bug(s)`);

    if (response.results.length > 0) {
      console.log('\n  📋 Recent bugs:');
      response.results.forEach((page, i) => {
        const title = page.properties['Title']?.title?.[0]?.text?.content || 'Untitled';
        const bugId = page.properties['Bug ID']?.unique_id?.number || 'N/A';
        const status = page.properties['Status']?.status?.name || 'Unknown';
        console.log(`     ${i + 1}. [#${bugId}] ${title} (${status})`);
      });
    }

    return true;
  } catch (error) {
    console.log(`  ❌ Query failed: ${error.message}`);
    return false;
  }
}

// Test creating a page (dry run info)
async function testCreateCapability() {
  console.log('\n✏️  Testing create capability...\n');

  const databaseId = process.env.NOTION_DATABASE_ID;

  try {
    // We'll create a test bug and immediately archive it
    const response = await notion.pages.create({
      parent: { database_id: databaseId },
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
    console.log(`  ❌ Create failed: ${error.message}`);

    if (error.message.includes('property')) {
      console.log('     → Check that your database has the required properties:');
      console.log('       Title, Description, Status, Severity, Priority, Date Created');
    }

    return false;
  }
}

// Run all tests
async function runTests() {
  const results = {};

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

  const tests = [
    ['Environment Variables', results.envVars],
    ['Authentication', results.auth],
    ['Database Access', results.dbAccess],
    ['Database Query', results.dbQuery],
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
  console.error('\n❌ Unexpected error:', error.message);
  process.exit(1);
});
