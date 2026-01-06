import { Client } from "@notionhq/client";
import type {
  PageObjectResponse,
  PartialPageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints.js";
import "dotenv/config";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const dataSourceId = process.env.NOTION_DATA_SOURCE_ID!;

// Types
export interface BugInput {
  title: string;
  description: string;
  severity: string;
  priority: string;
  assignee?: string;
  steps?: string;
  host?: string;
  deadline?: string;
}

export interface Bug {
  id: number | string;
  notionId: string;
  title: string;
  status: string;
  severity: string;
  priority: string;
  assignee: string;
}

export interface BugCreateResult {
  id: number | string;
  notionId: string;
}

// Helper to check if result is a full page
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
      status: { name: "Open" },
    },
    Severity: {
      select: { name: severity },
    },
    Priority: {
      select: { name: priority },
    },
    "Date Created": {
      date: { start: new Date().toISOString().split("T")[0] },
    },
  };

  if (assignee) {
    properties["Assignee"] = {
      rich_text: [{ text: { content: assignee } }],
    };
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

export async function listBugs(
  statusFilter: string | null = null
): Promise<Bug[]> {
  const filter = statusFilter
    ? {
        property: "Status",
        status: { equals: statusFilter },
      }
    : undefined;

  // Use dataSources.query with data_source_id (new API 2025-09-03)
  const response = await notion.dataSources.query({
    data_source_id: dataSourceId,
    filter,
    sorts: [{ property: "Date Created", direction: "descending" }],
  });

  return response.results
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
          rich_text?: Array<{ text?: { content: string } }>;
        }
      >;

      return {
        id: props["Bug ID"]?.unique_id?.number ?? "N/A",
        notionId: page.id,
        title: props["Title"]?.title?.[0]?.text?.content ?? "Untitled",
        status: props["Status"]?.status?.name ?? "Unknown",
        severity: props["Severity"]?.select?.name ?? "Unknown",
        priority: props["Priority"]?.select?.name ?? "Unknown",
        assignee:
          props["Assignee"]?.rich_text?.[0]?.text?.content ?? "Unassigned",
      };
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
  status: string
): Promise<{ success: boolean }> {
  const bug = await findBugByNumber(bugNumber);

  await notion.pages.update({
    page_id: bug.id,
    properties: {
      Status: {
        status: { name: status },
      },
    },
  });

  return { success: true };
}

export async function assignBug(
  bugNumber: number,
  assignee: string
): Promise<{ success: boolean }> {
  const bug = await findBugByNumber(bugNumber);

  await notion.pages.update({
    page_id: bug.id,
    properties: {
      Assignee: {
        rich_text: [{ text: { content: assignee } }],
      },
    },
  });

  return { success: true };
}

export async function completeBug(
  bugNumber: number
): Promise<{ success: boolean }> {
  const bug = await findBugByNumber(bugNumber);

  await notion.pages.update({
    page_id: bug.id,
    properties: {
      Status: {
        status: { name: "Closed" },
      },
      "Date Completed": {
        date: { start: new Date().toISOString().split("T")[0] },
      },
    },
  });

  return { success: true };
}
