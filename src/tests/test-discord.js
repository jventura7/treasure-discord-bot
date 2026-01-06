import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';

console.log('🧪 Discord API Connection Test\n');
console.log('='.repeat(50));

// Check environment variables
function checkEnvVars() {
  console.log('\n📋 Checking environment variables...\n');

  const vars = {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID
  };

  let allPresent = true;

  for (const [name, value] of Object.entries(vars)) {
    if (value) {
      const masked = value.slice(0, 8) + '...' + value.slice(-4);
      console.log(`  ✅ ${name}: ${masked}`);
    } else {
      console.log(`  ❌ ${name}: Missing`);
      allPresent = false;
    }
  }

  return allPresent;
}

// Test REST API (token validation)
async function testRestApi() {
  console.log('\n🔐 Testing REST API authentication...\n');

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    const user = await rest.get(Routes.user());
    console.log(`  ✅ Bot authenticated: ${user.username}#${user.discriminator || '0'}`);
    console.log(`  ✅ Bot ID: ${user.id}`);

    // Verify client ID matches
    if (user.id === process.env.DISCORD_CLIENT_ID) {
      console.log(`  ✅ Client ID matches bot ID`);
    } else {
      console.log(`  ⚠️  Client ID doesn't match bot ID`);
      console.log(`     Token bot ID: ${user.id}`);
      console.log(`     DISCORD_CLIENT_ID: ${process.env.DISCORD_CLIENT_ID}`);
    }

    return { success: true, user };
  } catch (error) {
    console.log(`  ❌ REST API failed: ${error.message}`);
    if (error.status === 401) {
      console.log('     → Your DISCORD_TOKEN is invalid or expired');
    }
    return { success: false };
  }
}

// Test guild access
async function testGuildAccess() {
  console.log('\n🏠 Testing guild access...\n');

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const guildId = process.env.DISCORD_GUILD_ID;

  try {
    const guild = await rest.get(Routes.guild(guildId));
    console.log(`  ✅ Guild found: ${guild.name}`);
    console.log(`  ✅ Guild ID: ${guild.id}`);
    console.log(`  ✅ Member count: ~${guild.approximate_member_count || 'N/A'}`);
    return { success: true, guild };
  } catch (error) {
    console.log(`  ❌ Guild access failed: ${error.message}`);
    if (error.status === 404) {
      console.log('     → Bot is not in this guild or guild ID is incorrect');
      console.log('     → Invite the bot using:');
      console.log(`       https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=2147485696&scope=bot%20applications.commands`);
    }
    return { success: false };
  }
}

// Test registered commands
async function testCommands() {
  console.log('\n⚡ Testing registered commands...\n');

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;

  try {
    // Check guild commands
    const guildCommands = await rest.get(Routes.applicationGuildCommands(clientId, guildId));

    if (guildCommands.length === 0) {
      console.log('  ⚠️  No guild commands registered');
      console.log('     → Run: npm run deploy-commands');
      return { success: true, commands: [] };
    }

    console.log(`  ✅ Found ${guildCommands.length} command(s):\n`);

    for (const cmd of guildCommands) {
      console.log(`     /${cmd.name}`);
      if (cmd.description) {
        console.log(`       ${cmd.description}`);
      }
      if (cmd.options) {
        const subcommands = cmd.options.filter(o => o.type === 1);
        if (subcommands.length > 0) {
          console.log(`       Subcommands: ${subcommands.map(s => s.name).join(', ')}`);
        }
      }
      console.log('');
    }

    return { success: true, commands: guildCommands };
  } catch (error) {
    console.log(`  ❌ Failed to fetch commands: ${error.message}`);
    return { success: false };
  }
}

// Test Gateway connection (brief)
async function testGateway() {
  console.log('\n🌐 Testing Gateway connection...\n');

  return new Promise((resolve) => {
    const client = new Client({
      intents: [GatewayIntentBits.Guilds]
    });

    const timeout = setTimeout(() => {
      console.log('  ❌ Gateway connection timed out (10s)');
      client.destroy();
      resolve({ success: false });
    }, 10000);

    client.once('ready', () => {
      clearTimeout(timeout);
      console.log(`  ✅ Gateway connected`);
      console.log(`  ✅ Logged in as: ${client.user.tag}`);
      console.log(`  ✅ Serving ${client.guilds.cache.size} guild(s)`);

      // List guilds
      if (client.guilds.cache.size > 0) {
        console.log('\n  📋 Guilds:');
        client.guilds.cache.forEach(guild => {
          const marker = guild.id === process.env.DISCORD_GUILD_ID ? ' ← target guild' : '';
          console.log(`     - ${guild.name} (${guild.id})${marker}`);
        });
      }

      client.destroy();
      resolve({ success: true });
    });

    client.on('error', (error) => {
      clearTimeout(timeout);
      console.log(`  ❌ Gateway error: ${error.message}`);
      client.destroy();
      resolve({ success: false });
    });

    client.login(process.env.DISCORD_TOKEN).catch((error) => {
      clearTimeout(timeout);
      console.log(`  ❌ Login failed: ${error.message}`);
      resolve({ success: false });
    });
  });
}

// Run all tests
async function runTests() {
  const results = {};

  results.envVars = checkEnvVars();

  if (results.envVars) {
    const restResult = await testRestApi();
    results.restApi = restResult.success;

    if (results.restApi) {
      const guildResult = await testGuildAccess();
      results.guildAccess = guildResult.success;

      const commandsResult = await testCommands();
      results.commands = commandsResult.success;

      const gatewayResult = await testGateway();
      results.gateway = gatewayResult.success;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary\n');

  const tests = [
    ['Environment Variables', results.envVars],
    ['REST API Auth', results.restApi],
    ['Guild Access', results.guildAccess],
    ['Commands', results.commands],
    ['Gateway Connection', results.gateway]
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
