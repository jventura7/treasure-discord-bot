import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { addBug, listBugs, updateBugStatus, assignBug, completeBug } from '../services/notion.js';

export const data = new SlashCommandBuilder()
  .setName('bug')
  .setDescription('Bug tracker commands')
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Add a new bug to the tracker')
      .addStringOption(option =>
        option.setName('title')
          .setDescription('Bug title')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('description')
          .setDescription('Bug description')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('severity')
          .setDescription('Bug severity')
          .setRequired(true)
          .addChoices(
            { name: 'Critical', value: 'Critical' },
            { name: 'High', value: 'High' },
            { name: 'Medium', value: 'Medium' },
            { name: 'Low', value: 'Low' }
          ))
      .addStringOption(option =>
        option.setName('priority')
          .setDescription('Bug priority')
          .setRequired(true)
          .addChoices(
            { name: 'Urgent', value: 'Urgent' },
            { name: 'High', value: 'High' },
            { name: 'Medium', value: 'Medium' },
            { name: 'Low', value: 'Low' }
          ))
      .addUserOption(option =>
        option.setName('assignee')
          .setDescription('Assign to a user')
          .setRequired(false))
      .addStringOption(option =>
        option.setName('steps')
          .setDescription('Reproduction steps')
          .setRequired(false))
      .addStringOption(option =>
        option.setName('host')
          .setDescription('Relevant host/environment')
          .setRequired(false))
      .addStringOption(option =>
        option.setName('deadline')
          .setDescription('Deadline (YYYY-MM-DD format)')
          .setRequired(false)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List all bugs')
      .addStringOption(option =>
        option.setName('status')
          .setDescription('Filter by status')
          .setRequired(false)
          .addChoices(
            { name: 'Open', value: 'Open' },
            { name: 'In Progress', value: 'In Progress' },
            { name: 'Resolved', value: 'Resolved' },
            { name: 'Closed', value: 'Closed' }
          )))
  .addSubcommand(subcommand =>
    subcommand
      .setName('update')
      .setDescription('Update a bug status')
      .addIntegerOption(option =>
        option.setName('id')
          .setDescription('Bug ID')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('status')
          .setDescription('New status')
          .setRequired(true)
          .addChoices(
            { name: 'Open', value: 'Open' },
            { name: 'In Progress', value: 'In Progress' },
            { name: 'Resolved', value: 'Resolved' },
            { name: 'Closed', value: 'Closed' }
          )))
  .addSubcommand(subcommand =>
    subcommand
      .setName('assign')
      .setDescription('Assign a bug to someone')
      .addIntegerOption(option =>
        option.setName('id')
          .setDescription('Bug ID')
          .setRequired(true))
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to assign')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('complete')
      .setDescription('Mark a bug as completed')
      .addIntegerOption(option =>
        option.setName('id')
          .setDescription('Bug ID')
          .setRequired(true)));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case 'add': {
        await interaction.deferReply();

        const title = interaction.options.getString('title', true);
        const description = interaction.options.getString('description', true);
        const severity = interaction.options.getString('severity', true);
        const priority = interaction.options.getString('priority', true);
        const assignee = interaction.options.getUser('assignee');
        const steps = interaction.options.getString('steps');
        const host = interaction.options.getString('host');
        const deadline = interaction.options.getString('deadline');

        const bug = await addBug({
          title,
          description,
          severity,
          priority,
          assignee: assignee?.username,
          steps: steps ?? undefined,
          host: host ?? undefined,
          deadline: deadline ?? undefined
        });

        await interaction.editReply({
          content: `Bug created successfully!\n**ID:** ${bug.id}\n**Title:** ${title}\n**Severity:** ${severity}\n**Priority:** ${priority}`
        });
        break;
      }

      case 'list': {
        await interaction.deferReply();

        const statusFilter = interaction.options.getString('status');
        const bugs = await listBugs(statusFilter);

        if (bugs.length === 0) {
          await interaction.editReply('No bugs found.');
          return;
        }

        const bugList = bugs.slice(0, 10).map(bug =>
          `**#${bug.id}** - ${bug.title} [${bug.status}] (${bug.severity})`
        ).join('\n');

        await interaction.editReply({
          content: `**Bug List${statusFilter ? ` (${statusFilter})` : ''}:**\n${bugList}${bugs.length > 10 ? `\n... and ${bugs.length - 10} more` : ''}`
        });
        break;
      }

      case 'update': {
        await interaction.deferReply();

        const bugId = interaction.options.getInteger('id', true);
        const status = interaction.options.getString('status', true);

        await updateBugStatus(bugId, status);

        await interaction.editReply({
          content: `Bug #${bugId} status updated to **${status}**`
        });
        break;
      }

      case 'assign': {
        await interaction.deferReply();

        const bugId = interaction.options.getInteger('id', true);
        const user = interaction.options.getUser('user', true);

        await assignBug(bugId, user.username);

        await interaction.editReply({
          content: `Bug #${bugId} assigned to **${user.username}**`
        });
        break;
      }

      case 'complete': {
        await interaction.deferReply();

        const bugId = interaction.options.getInteger('id', true);

        await completeBug(bugId);

        await interaction.editReply({
          content: `Bug #${bugId} marked as **completed**`
        });
        break;
      }
    }
  } catch (error) {
    console.error('Bug command error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (interaction.deferred) {
      await interaction.editReply({
        content: `Error: ${errorMessage}`
      });
    } else {
      await interaction.reply({
        content: `Error: ${errorMessage}`,
        ephemeral: true
      });
    }
  }
}
