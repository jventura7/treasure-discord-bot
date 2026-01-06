import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID;

export async function addBug({ title, description, severity, priority, assignee, steps, host, deadline }) {
  const properties = {
    'Title': {
      title: [{ text: { content: title } }]
    },
    'Description': {
      rich_text: [{ text: { content: description } }]
    },
    'Status': {
      status: { name: 'Open' }
    },
    'Severity': {
      select: { name: severity }
    },
    'Priority': {
      select: { name: priority }
    },
    'Date Created': {
      date: { start: new Date().toISOString().split('T')[0] }
    }
  };

  if (assignee) {
    properties['Assignee'] = {
      rich_text: [{ text: { content: assignee } }]
    };
  }

  if (steps) {
    properties['Reproduction Steps'] = {
      rich_text: [{ text: { content: steps } }]
    };
  }

  if (host) {
    properties['Relevant Host'] = {
      rich_text: [{ text: { content: host } }]
    };
  }

  if (deadline) {
    properties['Deadline'] = {
      date: { start: deadline }
    };
  }

  const response = await notion.pages.create({
    parent: { database_id: databaseId },
    properties
  });

  // Get the Bug ID from the created page
  const page = await notion.pages.retrieve({ page_id: response.id });
  const bugId = page.properties['Bug ID']?.unique_id?.number || 'N/A';

  return {
    id: bugId,
    notionId: response.id
  };
}

export async function listBugs(statusFilter = null) {
  const filter = statusFilter
    ? {
        property: 'Status',
        status: { equals: statusFilter }
      }
    : undefined;

  const response = await notion.databases.query({
    database_id: databaseId,
    filter,
    sorts: [{ property: 'Date Created', direction: 'descending' }]
  });

  return response.results.map(page => ({
    id: page.properties['Bug ID']?.unique_id?.number || 'N/A',
    notionId: page.id,
    title: page.properties['Title']?.title?.[0]?.text?.content || 'Untitled',
    status: page.properties['Status']?.status?.name || 'Unknown',
    severity: page.properties['Severity']?.select?.name || 'Unknown',
    priority: page.properties['Priority']?.select?.name || 'Unknown',
    assignee: page.properties['Assignee']?.rich_text?.[0]?.text?.content || 'Unassigned'
  }));
}

async function findBugByNumber(bugNumber) {
  const response = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: 'Bug ID',
      unique_id: { equals: bugNumber }
    }
  });

  if (response.results.length === 0) {
    throw new Error(`Bug #${bugNumber} not found`);
  }

  return response.results[0];
}

export async function updateBugStatus(bugNumber, status) {
  const bug = await findBugByNumber(bugNumber);

  await notion.pages.update({
    page_id: bug.id,
    properties: {
      'Status': {
        status: { name: status }
      }
    }
  });

  return { success: true };
}

export async function assignBug(bugNumber, assignee) {
  const bug = await findBugByNumber(bugNumber);

  await notion.pages.update({
    page_id: bug.id,
    properties: {
      'Assignee': {
        rich_text: [{ text: { content: assignee } }]
      }
    }
  });

  return { success: true };
}

export async function completeBug(bugNumber) {
  const bug = await findBugByNumber(bugNumber);

  await notion.pages.update({
    page_id: bug.id,
    properties: {
      'Status': {
        status: { name: 'Closed' }
      },
      'Date Completed': {
        date: { start: new Date().toISOString().split('T')[0] }
      }
    }
  });

  return { success: true };
}
