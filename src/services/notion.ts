import { Client } from "@notionhq/client";
import type {
  PageObjectResponse,
  PartialPageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints.js";
import "dotenv/config";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const dataSourceId = process.env.NOTION_DATA_SOURCE_ID!;

export enum BugSeverity {
  High = "High",
  Medium = "Medium",
  Low = "Low",
}

export enum BugPriority {
  Urgent = "Urgent",
  High = "High",
  Medium = "Medium",
  Low = "Low",
}

export enum BugStatus {
  Open = "Open",
  InProgress = "In Progress",
  TempFix = "Temp Fix",
  Fixed = "Fixed",
  NonIssue = "Non Issue",
}

export interface BugInput {
  title: string;
  description: string;
  severity: BugSeverity;
  priority: BugPriority;
  assignee?: string;
  steps?: string;
  host?: string;
  deadline?: string;
}

export interface Bug {
  id: number | string;
  notionId: string;
  title: string;
  status: BugStatus;
  severity: BugSeverity;
  priority: BugPriority;
  assignee: string;
}

export interface BugCreateResult {
  id: number | string;
  notionId: string;
}

export interface BugCompleteResult {
  success: boolean;
  title: string;
  description: string;
}

export interface BugUpdateResult {
  success: boolean;
  title: string;
  description: string;
}

export interface NotionUser {
  id: string;
  name: string;
  email?: string;
}

// Cache users for performance (refresh every 5 minutes)
let usersCache: NotionUser[] = [];
let usersCacheTime = 0;
const USERS_CACHE_TTL = 5 * 60 * 1000;

export async function listUsers(): Promise<NotionUser[]> {
  const now = Date.now();
  if (usersCache.length > 0 && now - usersCacheTime < USERS_CACHE_TTL) {
    return usersCache;
  }

  const response = await notion.users.list({});
  usersCache = response.results
    .filter((user) => user.type === "person")
    .map((user) => ({
      id: user.id,
      name: user.name ?? "Unknown",
      email: user.type === "person" ? user.person?.email : undefined,
    }));
  usersCacheTime = now;

  return usersCache;
}

export async function findUserByName(
  nameQuery: string
): Promise<NotionUser | null> {
  const users = await listUsers();
  const query = nameQuery.toLowerCase().trim();

  // Exact match first
  const exactMatch = users.find((u) => u.name.toLowerCase() === query);
  if (exactMatch) return exactMatch;

  // Partial match (name contains query or query contains name)
  const partialMatch = users.find(
    (u) =>
      u.name.toLowerCase().includes(query) ||
      query.includes(u.name.toLowerCase())
  );
  if (partialMatch) return partialMatch;

  // Fuzzy match: check if all words in query appear in name
  const queryWords = query.split(/\s+/);
  const fuzzyMatch = users.find((u) => {
    const nameLower = u.name.toLowerCase();
    return queryWords.every((word) => nameLower.includes(word));
  });

  return fuzzyMatch ?? null;
}

function isFullPage(
  page: PageObjectResponse | PartialPageObjectResponse
): page is PageObjectResponse {
  return "properties" in page;
}

export async function addBug({
  title,
  description,
  severity,
  priority,
  assignee,
  steps,
  host,
  deadline,
}: BugInput): Promise<BugCreateResult> {
  const properties: Record<string, unknown> = {
    Title: {
      title: [{ text: { content: title } }],
    },
    Description: {
      rich_text: [{ text: { content: description } }],
    },
    Status: {
      status: { name: BugStatus.Open },
    },
    Severity: {
      select: { name: severity },
    },
    Priority: {
      select: { name: priority },
    },
    "Date Created": {
      date: { start: new Date().toISOString() },
    },
  };

  if (assignee) {
    const user = await findUserByName(assignee);
    if (user) {
      properties["Assignee"] = {
        people: [{ id: user.id }],
      };
    }
  }

  if (steps) {
    properties["Reproduction Steps"] = {
      rich_text: [{ text: { content: steps } }],
    };
  }

  if (host) {
    properties["Relevant Host"] = {
      rich_text: [{ text: { content: host } }],
    };
  }

  if (deadline) {
    properties["Deadline"] = {
      date: { start: deadline },
    };
  }

  // Use data_source_id for the new API (2025-09-03)
  const response = await notion.pages.create({
    parent: { data_source_id: dataSourceId },
    properties: properties as Parameters<
      typeof notion.pages.create
    >[0]["properties"],
  });

  // Get the Bug ID from the created page
  const page = await notion.pages.retrieve({ page_id: response.id });
  const pageProps = (
    page as { properties: Record<string, { unique_id?: { number: number } }> }
  ).properties;
  const bugId = pageProps["Bug ID"]?.unique_id?.number ?? "N/A";

  return {
    id: bugId,
    notionId: response.id,
  };
}

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

export async function listBugs(
  statusFilter: string | null = null
): Promise<Bug[]> {
  // When no filter provided, exclude completed (Fixed) bugs
  const filter = statusFilter
    ? {
        property: "Status",
        status: { equals: statusFilter },
      }
    : {
        property: "Status",
        status: { does_not_equal: BugStatus.Fixed },
      };

  // Use dataSources.query with data_source_id (new API 2025-09-03)
  const response = await notion.dataSources.query({
    data_source_id: dataSourceId,
    filter,
  });

  const bugs = response.results
    .filter((page): page is PageObjectResponse =>
      isFullPage(page as PageObjectResponse | PartialPageObjectResponse)
    )
    .map((page) => {
      const props = page.properties as Record<
        string,
        {
          unique_id?: { number: number };
          title?: Array<{ text?: { content: string } }>;
          status?: { name: string };
          select?: { name: string };
          people?: Array<{ name?: string }>;
        }
      >;

      return {
        id: props["Bug ID"]?.unique_id?.number ?? "N/A",
        notionId: page.id,
        title: props["Title"]?.title?.[0]?.text?.content ?? "Untitled",
        status: (props["Status"]?.status?.name ?? BugStatus.Open) as BugStatus,
        severity: (props["Severity"]?.select?.name ??
          BugSeverity.Medium) as BugSeverity,
        priority: (props["Priority"]?.select?.name ??
          BugPriority.Medium) as BugPriority,
        assignee: props["Assignee"]?.people?.[0]?.name ?? "Unassigned",
      };
    });

  // Sort by priority first, then by severity
  return bugs.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

async function findBugByNumber(bugNumber: number): Promise<{ id: string }> {
  // Use dataSources.query with data_source_id (new API 2025-09-03)
  const response = await notion.dataSources.query({
    data_source_id: dataSourceId,
    filter: {
      property: "Bug ID",
      unique_id: { equals: bugNumber },
    },
  });

  if (response.results.length === 0) {
    throw new Error(`Bug #${bugNumber} not found`);
  }

  return response.results[0] as { id: string };
}

export async function updateBugStatus(
  bugNumber: number,
  status: string,
  assignee?: string
): Promise<BugUpdateResult> {
  const bug = await findBugByNumber(bugNumber);

  // Fetch current page details to get title and description
  const page = (await notion.pages.retrieve({
    page_id: bug.id,
  })) as PageObjectResponse;

  const props = page.properties as Record<
    string,
    {
      title?: Array<{ text?: { content: string } }>;
      rich_text?: Array<{ text?: { content: string } }>;
    }
  >;

  const title = props["Title"]?.title?.[0]?.text?.content ?? "Untitled";
  const description =
    props["Description"]?.rich_text?.[0]?.text?.content ?? "No description";

  const properties: Record<string, unknown> = {
    Status: {
      status: { name: status },
    },
  };

  if (assignee) {
    const user = await findUserByName(assignee);
    if (user) {
      properties["Assignee"] = {
        people: [{ id: user.id }],
      };
    }
  }

  await notion.pages.update({
    page_id: bug.id,
    properties: properties as Parameters<
      typeof notion.pages.update
    >[0]["properties"],
  });

  return { success: true, title, description };
}

export async function assignBug(
  bugNumber: number,
  assignee: string
): Promise<{ success: boolean; assignedTo?: string }> {
  const bug = await findBugByNumber(bugNumber);

  const user = await findUserByName(assignee);
  if (!user) {
    throw new Error(
      `User "${assignee}" not found. Use /bug users to see available users.`
    );
  }

  await notion.pages.update({
    page_id: bug.id,
    properties: {
      Assignee: {
        people: [{ id: user.id }],
      },
    } as Parameters<typeof notion.pages.update>[0]["properties"],
  });

  return { success: true, assignedTo: user.name };
}

export async function completeBug(
  bugNumber: number,
  assignee?: string
): Promise<BugCompleteResult> {
  const bug = await findBugByNumber(bugNumber);

  // Fetch current page details to get title and description
  const page = (await notion.pages.retrieve({
    page_id: bug.id,
  })) as PageObjectResponse;

  const props = page.properties as Record<
    string,
    {
      title?: Array<{ text?: { content: string } }>;
      rich_text?: Array<{ text?: { content: string } }>;
    }
  >;

  const title = props["Title"]?.title?.[0]?.text?.content ?? "Untitled";
  const description =
    props["Description"]?.rich_text?.[0]?.text?.content ?? "No description";

  const properties: Record<string, unknown> = {
    Status: {
      status: { name: BugStatus.Fixed },
    },
    "Date Completed": {
      date: { start: new Date().toISOString() },
    },
  };

  if (assignee) {
    const user = await findUserByName(assignee);
    if (user) {
      properties["Assignee"] = {
        people: [{ id: user.id }],
      };
    }
  }

  await notion.pages.update({
    page_id: bug.id,
    properties: properties as Parameters<
      typeof notion.pages.update
    >[0]["properties"],
  });

  return { success: true, title, description };
}
