import { REST, Routes, RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import 'dotenv/config';
import { data as bugCommand } from './commands/bug.js';

const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [bugCommand.toJSON()];

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

async function deployCommands(): Promise<void> {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    const data = await rest.put(
      Routes.applicationGuildCommands(
        process.env.DISCORD_CLIENT_ID!,
        process.env.DISCORD_GUILD_ID!
      ),
      { body: commands }
    ) as unknown[];

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error('Error deploying commands:', error);
  }
}

deployCommands();
