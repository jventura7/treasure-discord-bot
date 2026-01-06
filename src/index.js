import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from 'dotenv';
import * as bugCommand from './commands/bug.js';

// Load environment variables
config();

// Create Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Set up commands collection
client.commands = new Collection();
client.commands.set(bugCommand.data.name, bugCommand);

// Bot ready event
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Bot is ready and serving ${client.guilds.cache.size} guild(s)`);
});

// Handle slash command interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing ${interaction.commandName}:`, error);

    const errorMessage = {
      content: 'There was an error executing this command!',
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);
