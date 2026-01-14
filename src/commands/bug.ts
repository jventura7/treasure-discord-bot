import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Colors,
} from "discord.js";
import {
  addBug,
  listBugs,
  updateBugStatus,
  assignBug,
  completeBug,
  BugSeverity,
  BugPriority,
  BugStatus,
  type Bug,
} from "../services/notion.js";

// Emoji helpers
function severityEmoji(severity: BugSeverity): string {
  switch (severity) {
    case BugSeverity.High:
      return "🔴";
    case BugSeverity.Medium:
      return "🟡";
    case BugSeverity.Low:
      return "🟢";
    default:
      return "⚪";
  }
}

function priorityEmoji(priority: BugPriority): string {
  switch (priority) {
    case BugPriority.Urgent:
      return "🚨";
    case BugPriority.High:
      return "⬆️";
    case BugPriority.Medium:
      return "➡️";
    case BugPriority.Low:
      return "⬇️";
    default:
      return "➡️";
  }
}

function statusEmoji(status: BugStatus): string {
  switch (status) {
    case BugStatus.Open:
      return "🔵";
    case BugStatus.InProgress:
      return "🟠";
    case BugStatus.TempFix:
      return "🟣";
    case BugStatus.Fixed:
      return "✅";
    case BugStatus.NonIssue:
      return "⚪";
    default:
      return "🔵";
  }
}

function severityColor(severity: BugSeverity): number {
  switch (severity) {
    case BugSeverity.High:
      return Colors.Red;
    case BugSeverity.Medium:
      return Colors.Yellow;
    case BugSeverity.Low:
      return Colors.Green;
    default:
      return Colors.Blurple;
  }
}

export const data = new SlashCommandBuilder()
  .setName("bug")
  .setDescription("Bug tracker commands")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("add")
      .setDescription("Add a new bug to the tracker")
      .addStringOption((option) =>
        option.setName("title").setDescription("Bug title").setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("description")
          .setDescription("Bug description")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("severity")
          .setDescription("Bug severity")
          .setRequired(true)
          .addChoices(
            { name: "High", value: BugSeverity.High },
            { name: "Medium", value: BugSeverity.Medium },
            { name: "Low", value: BugSeverity.Low }
          )
      )
      .addStringOption((option) =>
        option
          .setName("priority")
          .setDescription("Bug priority")
          .setRequired(true)
          .addChoices(
            { name: "Urgent", value: BugPriority.Urgent },
            { name: "High", value: BugPriority.High },
            { name: "Medium", value: BugPriority.Medium },
            { name: "Low", value: BugPriority.Low }
          )
      )
      .addStringOption((option) =>
        option
          .setName("assignee")
          .setDescription("Assign to a Notion user (name or partial name)")
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName("steps")
          .setDescription("Reproduction steps")
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName("host")
          .setDescription("Relevant host/environment")
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName("deadline")
          .setDescription("Deadline (YYYY-MM-DD format)")
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("list")
      .setDescription("List all bugs")
      .addStringOption((option) =>
        option
          .setName("status")
          .setDescription("Filter by status")
          .setRequired(false)
          .addChoices(
            { name: "Open", value: BugStatus.Open },
            { name: "In Progress", value: BugStatus.InProgress },
            { name: "Temp Fix", value: BugStatus.TempFix },
            { name: "Fixed", value: BugStatus.Fixed },
            { name: "Non Issue", value: BugStatus.NonIssue }
          )
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("update")
      .setDescription("Update a bug status")
      .addIntegerOption((option) =>
        option.setName("id").setDescription("Bug ID").setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("status")
          .setDescription("New status")
          .setRequired(true)
          .addChoices(
            { name: "Open", value: BugStatus.Open },
            { name: "In Progress", value: BugStatus.InProgress },
            { name: "Temp Fix", value: BugStatus.TempFix },
            { name: "Fixed", value: BugStatus.Fixed },
            { name: "Non Issue", value: BugStatus.NonIssue }
          )
      )
      .addStringOption((option) =>
        option
          .setName("assignee")
          .setDescription("Assign to a Notion user (name or partial name)")
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("assign")
      .setDescription("Assign a bug to someone")
      .addIntegerOption((option) =>
        option.setName("id").setDescription("Bug ID").setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("user")
          .setDescription("Notion user to assign (name or partial name)")
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("complete")
      .setDescription("Mark a bug as completed")
      .addIntegerOption((option) =>
        option.setName("id").setDescription("Bug ID").setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("assignee")
          .setDescription("Assign to a Notion user (name or partial name)")
          .setRequired(false)
      )
  );

function formatBugLine(bug: Bug): string {
  return `**#${bug.id}** │ ${bug.title}\n${statusEmoji(bug.status)} ${bug.status} · ${severityEmoji(bug.severity)} ${bug.severity} · ${priorityEmoji(bug.priority)} ${bug.priority} · 👤 ${bug.assignee}`;
}

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case "add": {
        await interaction.deferReply();

        const title = interaction.options.getString("title", true);
        const description = interaction.options.getString("description", true);
        const severity = interaction.options.getString(
          "severity",
          true
        ) as BugSeverity;
        const priority = interaction.options.getString(
          "priority",
          true
        ) as BugPriority;
        const assignee = interaction.options.getString("assignee");
        const steps = interaction.options.getString("steps");
        const host = interaction.options.getString("host");
        const deadline = interaction.options.getString("deadline");

        const bug = await addBug({
          title,
          description,
          severity,
          priority,
          assignee: assignee ?? undefined,
          steps: steps ?? undefined,
          host: host ?? undefined,
          deadline: deadline ?? undefined,
        });

        const embed = new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle("✅ Bug Created Successfully")
          .addFields(
            { name: "Bug ID", value: `#${bug.id}`, inline: true },
            {
              name: "Status",
              value: `${statusEmoji(BugStatus.Open)} Open`,
              inline: true,
            },
            { name: "\u200b", value: "\u200b", inline: true },
            { name: "Title", value: title },
            { name: "Description", value: description },
            {
              name: "Severity",
              value: `${severityEmoji(severity)} ${severity}`,
              inline: true,
            },
            {
              name: "Priority",
              value: `${priorityEmoji(priority)} ${priority}`,
              inline: true,
            },
            {
              name: "Assignee",
              value: assignee ?? "Unassigned",
              inline: true,
            }
          )
          .setTimestamp()
          .setFooter({ text: "Bug Tracker" });

        if (steps) {
          embed.addFields({ name: "Reproduction Steps", value: steps });
        }
        if (host) {
          embed.addFields({ name: "Environment", value: host, inline: true });
        }
        if (deadline) {
          embed.addFields({ name: "Deadline", value: deadline, inline: true });
        }

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case "list": {
        await interaction.deferReply();

        const statusFilter = interaction.options.getString("status");
        const bugs = await listBugs(statusFilter);

        const embed = new EmbedBuilder()
          .setColor(Colors.Blurple)
          .setTitle("🐛 Bug Tracker")
          .setTimestamp()
          .setFooter({ text: "Bug Tracker" });

        if (bugs.length === 0) {
          embed.setDescription(
            statusFilter
              ? `No bugs found with status: **${statusFilter}**\n\nTry a different filter or view all bugs with \`/bug list\``
              : "No bugs found.\n\nCreate one with `/bug add`"
          );
        } else {
          const filterText = statusFilter ? ` (${statusFilter})` : "";
          embed.setTitle(`🐛 Bug Tracker - ${bugs.length} bug${bugs.length > 1 ? "s" : ""}${filterText}`);

          const bugLines = bugs
            .slice(0, 10)
            .map((bug) => formatBugLine(bug))
            .join("\n\n");

          embed.setDescription(bugLines);

          if (bugs.length > 10) {
            embed.addFields({
              name: "\u200b",
              value: `*...and ${bugs.length - 10} more bugs*`,
            });
          }
        }

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case "update": {
        await interaction.deferReply();

        const bugId = interaction.options.getInteger("id", true);
        const status = interaction.options.getString("status", true) as BugStatus;
        const assignee = interaction.options.getString("assignee");

        const result = await updateBugStatus(bugId, status, assignee ?? undefined);

        const embed = new EmbedBuilder()
          .setColor(Colors.Yellow)
          .setTitle("🔄 Bug Updated")
          .addFields(
            { name: "Bug ID", value: `#${bugId}`, inline: true },
            {
              name: "New Status",
              value: `${statusEmoji(status)} ${status}`,
              inline: true,
            },
            { name: "\u200b", value: "\u200b", inline: true },
            { name: "Title", value: result.title },
            { name: "Description", value: result.description }
          )
          .setTimestamp()
          .setFooter({ text: "Bug Tracker" });

        if (assignee) {
          embed.addFields({ name: "Assignee", value: assignee, inline: true });
        }

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case "assign": {
        await interaction.deferReply();

        const bugId = interaction.options.getInteger("id", true);
        const userName = interaction.options.getString("user", true);

        const result = await assignBug(bugId, userName);

        const embed = new EmbedBuilder()
          .setColor(Colors.Blurple)
          .setTitle("👤 Bug Assigned")
          .addFields(
            { name: "Bug ID", value: `#${bugId}`, inline: true },
            { name: "Assignee", value: result.assignedTo ?? userName, inline: true }
          )
          .setTimestamp()
          .setFooter({ text: "Bug Tracker" });

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case "complete": {
        await interaction.deferReply();

        const bugId = interaction.options.getInteger("id", true);
        const assignee = interaction.options.getString("assignee");

        const result = await completeBug(bugId, assignee ?? undefined);

        const embed = new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle("✅ Bug Completed")
          .addFields(
            { name: "Bug ID", value: `#${bugId}`, inline: true },
            {
              name: "Status",
              value: `${statusEmoji(BugStatus.Fixed)} Fixed`,
              inline: true,
            },
            { name: "\u200b", value: "\u200b", inline: true },
            { name: "Title", value: result.title },
            { name: "Description", value: result.description }
          )
          .setTimestamp()
          .setFooter({ text: "Bug Tracker" });

        if (assignee) {
          embed.addFields({ name: "Assignee", value: assignee, inline: true });
        }

        await interaction.editReply({ embeds: [embed] });
        break;
      }
    }
  } catch (error) {
    console.error("Bug command error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    const embed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle("❌ Error")
      .setDescription(errorMessage)
      .setFooter({ text: "Please check the bug ID and try again" });

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}
