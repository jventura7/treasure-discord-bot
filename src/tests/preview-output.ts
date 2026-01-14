import { BugSeverity, BugPriority, BugStatus } from "../services/notion.js";

/**
 * Preview script to see how Discord bot output will look
 * Run with: npm run preview
 */

const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
};

const c = COLORS;

function divider(title: string) {
  console.log(`\n${c.dim}${"─".repeat(60)}${c.reset}`);
  console.log(`${c.bold}${c.cyan}${title}${c.reset}`);
  console.log(`${c.dim}${"─".repeat(60)}${c.reset}\n`);
}

function embedBox(
  color: string,
  title: string,
  fields: Array<{ name: string; value: string; inline?: boolean }>,
  footer?: string
) {
  const colorBar =
    color === "red"
      ? c.red
      : color === "green"
      ? c.green
      : color === "yellow"
      ? c.yellow
      : c.blue;

  console.log(`${colorBar}┃${c.reset} ${c.bold}${title}${c.reset}`);
  console.log(`${colorBar}┃${c.reset}`);

  // Group inline fields
  let i = 0;
  while (i < fields.length) {
    const field = fields[i];
    if (field.inline && fields[i + 1]?.inline) {
      // Print two inline fields side by side
      const f1 = `${c.dim}${field.name}${c.reset}\n${colorBar}┃${c.reset}   ${field.value}`;
      const f2 = `${c.dim}${fields[i + 1].name}${c.reset}\n${colorBar}┃${
        c.reset
      }   ${fields[i + 1].value}`;
      console.log(
        `${colorBar}┃${c.reset}   ${c.dim}${field.name.padEnd(20)}${
          fields[i + 1].name
        }${c.reset}`
      );
      console.log(
        `${colorBar}┃${c.reset}   ${field.value.padEnd(20)}${
          fields[i + 1].value
        }`
      );
      i += 2;
    } else {
      console.log(`${colorBar}┃${c.reset}   ${c.dim}${field.name}${c.reset}`);
      console.log(`${colorBar}┃${c.reset}   ${field.value}`);
      i++;
    }
    console.log(`${colorBar}┃${c.reset}`);
  }

  if (footer) {
    console.log(`${colorBar}┃${c.reset} ${c.dim}${footer}${c.reset}`);
  }
  console.log();
}

function severityEmoji(severity: BugSeverity): string {
  switch (severity) {
    case BugSeverity.High:
      return "🔴";
    case BugSeverity.Medium:
      return "🟡";
    case BugSeverity.Low:
      return "🟢";
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
  }
}

function statusEmoji(status: BugStatus): string {
  switch (status) {
    case BugStatus.Open:
      return "🔵";
    case BugStatus.InProgress:
      return "🟠";
    case BugStatus.Fixed:
      return "✅";
    case BugStatus.NonIssue:
      return "⚪";
    case BugStatus.TempFix:
      return "🟣";
  }
}

// Preview: /bug add
divider("📝 /bug add - Create a new bug");
console.log(
  `${c.dim}Command: /bug add title:"Login button broken" description:"Can't click login" severity:High priority:Urgent assignee:@john${c.reset}\n`
);

embedBox(
  "green",
  "✅ Bug Created Successfully",
  [
    { name: "Bug ID", value: "#42", inline: true },
    {
      name: "Status",
      value: `${statusEmoji(BugStatus.Open)} Open`,
      inline: true,
    },
    { name: "Title", value: "Login button broken" },
    { name: "Description", value: "Can't click login" },
    {
      name: "Severity",
      value: `${severityEmoji(BugSeverity.High)} High`,
      inline: true,
    },
    {
      name: "Priority",
      value: `${priorityEmoji(BugPriority.Urgent)} Urgent`,
      inline: true,
    },
    { name: "Assignee", value: "@john", inline: true },
  ],
  "Created just now"
);

// Preview: /bug list
divider("📋 /bug list - List all bugs (excludes Fixed, sorted by priority then severity)");
console.log(`${c.dim}Command: /bug list${c.reset}\n`);

// All bugs including Fixed (for filtered views)
const allBugs = [
  {
    id: 42,
    title: "Login button broken",
    status: BugStatus.Open,
    severity: BugSeverity.High,
    priority: BugPriority.Urgent,
    assignee: "john",
  },
  {
    id: 41,
    title: "CSS alignment issue on mobile",
    status: BugStatus.InProgress,
    severity: BugSeverity.Medium,
    priority: BugPriority.High,
    assignee: "jane",
  },
  {
    id: 43,
    title: "Database connection pool exhausted",
    status: BugStatus.TempFix,
    severity: BugSeverity.High,
    priority: BugPriority.High,
    assignee: "bob",
  },
  {
    id: 40,
    title: "Typo in footer",
    status: BugStatus.Open,
    severity: BugSeverity.Low,
    priority: BugPriority.Low,
    assignee: "Unassigned",
  },
  {
    id: 39,
    title: "API timeout on large requests",
    status: BugStatus.Fixed,
    severity: BugSeverity.High,
    priority: BugPriority.High,
    assignee: "bob",
  },
];

// Priority and severity order for sorting
const priorityOrder: Record<BugPriority, number> = {
  [BugPriority.Urgent]: 0,
  [BugPriority.High]: 1,
  [BugPriority.Medium]: 2,
  [BugPriority.Low]: 3,
};

const severityOrder: Record<BugSeverity, number> = {
  [BugSeverity.High]: 0,
  [BugSeverity.Medium]: 1,
  [BugSeverity.Low]: 2,
};

// Default list: exclude Fixed, sorted by priority then severity
const sampleBugs = allBugs
  .filter((b) => b.status !== BugStatus.Fixed)
  .sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

console.log(
  `${c.blue}┃${c.reset} ${c.bold}🐛 Bug Tracker - ${sampleBugs.length} bugs found${c.reset}`
);
console.log(`${c.blue}┃${c.reset}`);

sampleBugs.forEach((bug) => {
  const statusIcon = statusEmoji(bug.status);
  const severityIcon = severityEmoji(bug.severity);
  const priorityIcon = priorityEmoji(bug.priority);

  console.log(
    `${c.blue}┃${c.reset}  ${c.bold}#${bug.id}${c.reset} │ ${bug.title}`
  );
  console.log(
    `${c.blue}┃${c.reset}       ${statusIcon} ${bug.status.padEnd(
      12
    )} ${severityIcon} ${bug.severity.padEnd(
      8
    )} ${priorityIcon} ${bug.priority.padEnd(8)} 👤 ${bug.assignee}`
  );
  console.log(`${c.blue}┃${c.reset}`);
});

console.log();

// Preview: /bug list (with filter)
divider("📋 /bug list status:Open - Filtered list");
console.log(`${c.dim}Command: /bug list status:Open${c.reset}\n`);

const openBugs = allBugs.filter((b) => b.status === BugStatus.Open);
console.log(
  `${c.blue}┃${c.reset} ${c.bold}🐛 Bug Tracker - ${openBugs.length} open bugs${c.reset}`
);
console.log(`${c.blue}┃${c.reset}`);

openBugs.forEach((bug) => {
  console.log(
    `${c.blue}┃${c.reset}  ${c.bold}#${bug.id}${c.reset} │ ${bug.title}`
  );
  console.log(
    `${c.blue}┃${c.reset}       ${statusEmoji(bug.status)} ${bug.status.padEnd(
      12
    )} ${severityEmoji(bug.severity)} ${bug.severity.padEnd(8)} ${priorityEmoji(
      bug.priority
    )} ${bug.priority.padEnd(8)} 👤 ${bug.assignee}`
  );
  console.log(`${c.blue}┃${c.reset}`);
});

console.log();

// Preview: /bug update
divider("🔄 /bug update - Update bug status");
console.log(
  `${c.dim}Command: /bug update id:42 status:"In Progress" assignee:jane${c.reset}\n`
);

embedBox(
  "yellow",
  "🔄 Bug Updated",
  [
    { name: "Bug ID", value: "#42", inline: true },
    {
      name: "New Status",
      value: `${statusEmoji(BugStatus.InProgress)} In Progress`,
      inline: true,
    },
    { name: "Title", value: "Login button broken" },
    { name: "Description", value: "Can't click login" },
    { name: "Assignee", value: "Jane Doe", inline: true },
  ],
  "Status changed from Open → In Progress"
);

// Preview: /bug assign
divider("👤 /bug assign - Assign a bug");
console.log(`${c.dim}Command: /bug assign id:42 user:@jane${c.reset}\n`);

embedBox(
  "blue",
  "👤 Bug Assigned",
  [
    { name: "Bug ID", value: "#42", inline: true },
    { name: "Assignee", value: "@jane", inline: true },
  ],
  "Bug reassigned successfully"
);

// Preview: /bug complete
divider("✅ /bug complete - Mark bug as fixed");
console.log(`${c.dim}Command: /bug complete id:42 assignee:john${c.reset}\n`);

embedBox(
  "green",
  "✅ Bug Completed",
  [
    { name: "Bug ID", value: "#42", inline: true },
    {
      name: "Status",
      value: `${statusEmoji(BugStatus.Fixed)} Fixed`,
      inline: true,
    },
    { name: "Title", value: "Login button broken" },
    { name: "Description", value: "Can't click login" },
    { name: "Completed At", value: new Date().toLocaleString() },
  ],
  "Bug has been marked as fixed"
);

// Preview: Error state
divider("❌ Error State");
console.log(`${c.dim}Command: /bug complete id:9999${c.reset}\n`);

embedBox(
  "red",
  "❌ Error",
  [{ name: "Message", value: "Bug #9999 not found" }],
  "Please check the bug ID and try again"
);

// Preview: Empty list
divider("📋 Empty List State");
console.log(
  `${c.dim}Command: /bug list status:Fixed (when no fixed bugs)${c.reset}\n`
);

console.log(`${c.blue}┃${c.reset} ${c.bold}🐛 Bug Tracker${c.reset}`);
console.log(`${c.blue}┃${c.reset}`);
console.log(
  `${c.blue}┃${c.reset}  ${c.dim}No bugs found matching your filter.${c.reset}`
);
console.log(
  `${c.blue}┃${c.reset}  ${c.dim}Try a different status or view all bugs with /bug list${c.reset}`
);
console.log();

console.log(`\n${c.dim}${"─".repeat(60)}${c.reset}`);
console.log(`${c.bold}${c.green}Preview complete!${c.reset}`);
console.log(
  `${c.dim}These are approximate representations of Discord embeds.${c.reset}`
);
console.log(`${c.dim}${"─".repeat(60)}${c.reset}\n`);
