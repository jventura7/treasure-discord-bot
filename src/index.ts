import { Client, GatewayIntentBits, Collection, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import 'dotenv/config';
import * as bugCommand from './commands/bug.js';

// Extend the Client type to include commands collection
interface BotCommand {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

interface BotClient extends Client {
  commands: Collection<string, BotCommand>;
}

// Create Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
}) as BotClient;

// Set up commands collection
client.commands = new Collection();
client.commands.set(bugCommand.data.name, bugCommand as BotCommand);

// Bot ready event
client.once('ready', () => {
  console.log(`Logged in as ${client.user?.tag}`);
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
      ephemeral: true as const
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
