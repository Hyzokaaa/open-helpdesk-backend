import { DataSource } from 'typeorm';
import { Readable } from 'stream';
import { ExportWorkspace } from '../../../../src/workspace/domain/services/workspace-export';
import { buildImportPreview, ImportArchiveFiles, ImportWorkspace } from '../../../../src/workspace/domain/services/workspace-import';
import { FakeS3Storage } from '../../../mocks/fake-s3-storage';
import { applyTransforms, CURRENT_VERSION } from '../../../../src/workspace/domain/services/workspace-export-transforms';
import { WorkspaceExportData } from '../../../../src/workspace/domain/workspace-export';
import { DomainValidationError } from '../../../../src/shared/domain/errors';

interface RecordedQuery {
  sql: string;
  params: unknown[];
}

type Answer = (sql: string, params: unknown[]) => unknown[];

/** In-memory stand-in for a TypeORM QueryRunner: records every statement and answers by SQL shape. */
class FakeQueryRunner {
  queries: RecordedQuery[] = [];
  committed = false;
  rolledBack = false;

  constructor(private readonly answer: Answer) {}

  async connect() {}
  async startTransaction() {}
  async commitTransaction() { this.committed = true; }
  async rollbackTransaction() { this.rolledBack = true; }
  async release() {}

  async query(sql: string, params: unknown[] = []) {
    this.queries.push({ sql, params });
    return this.answer(sql, params);
  }

  find(pattern: RegExp): RecordedQuery[] {
    return this.queries.filter((q) => pattern.test(q.sql));
  }
}

/** The files of a decoded archive, in memory. */
function archiveOf(files: Record<string, Buffer>): ImportArchiveFiles {
  return {
    size: (path) => files[path]?.length ?? null,
    open: (path) => Readable.from([files[path]]),
  };
}

function dataSourceOf(qr: FakeQueryRunner): DataSource {
  return { createQueryRunner: () => qr } as unknown as DataSource;
}

function emptyExport(overrides: Partial<WorkspaceExportData> = {}): WorkspaceExportData {
  return {
    version: CURRENT_VERSION,
    exportedAt: '2026-01-01T00:00:00.000Z',
    workspace: { name: 'Acme', description: '', slaPolicy: null, metadata: null },
    users: [],
    organizations: [],
    departments: [],
    tags: [],
    categories: [],
    projects: [],
    tickets: [],
    comments: [],
    descriptionEdits: [],
    commentEdits: [],
    attachments: [],
    participants: [],
    cannedResponses: [],
    customFields: [],
    csatResponses: [],
    kbCategories: [],
    kbArticles: [],
    auditLog: [],
    ...overrides,
  };
}

function ticket(id: string, category: string | null): WorkspaceExportData['tickets'][number] {
  return {
    id,
    name: `Ticket ${id}`,
    description: 'desc',
    priority: 'medium',
    status: 'open',
    category,
    reporterEmail: 'alice@example.com',
    assigneeEmail: null,
    ticketNumber: 1,
    customFields: {},
    discardReason: null,
    portalToken: null,
    firstResponseAt: null,
    resolvedAt: null,
    resolvedByEmail: null,
    firstResponseBreached: false,
    resolutionBreached: false,
    tagIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('ExportWorkspace', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');

  const answer: Answer = (sql) => {
    if (/FROM workspaces WHERE id/.test(sql)) {
      return [{ name: 'Acme', description: 'd', slaPolicy: null, metadata: null }];
    }
    if (/FROM ticket_categories/.test(sql)) {
      return [{ id: 'cat-1', name: 'Bug', slug: 'bug', color: 'red', createdAt }];
    }
    if (/FROM tickets t/.test(sql)) {
      return [
        { id: 't-1', name: 'Broken', status: 'open', category: 'bug', reporterId: 'u-1', tagIds: [], createdAt, updatedAt: createdAt },
        { id: 't-2', name: 'Uncategorised', status: 'open', category: null, reporterId: 'u-1', tagIds: [], createdAt, updatedAt: createdAt },
      ];
    }
    return [];
  };

  it('resolves the ticket category through ticket_categories instead of the dropped tickets.category column', async () => {
    const qr = new FakeQueryRunner(answer);
    const result = await new ExportWorkspace(dataSourceOf(qr)).execute('ws-1');

    const [ticketQuery] = qr.find(/FROM tickets t\s/);
    expect(ticketQuery).toBeDefined();
    expect(ticketQuery.sql).not.toMatch(/t\.category\b/);
    expect(ticketQuery.sql).toMatch(/LEFT JOIN ticket_categories tc ON tc\.id = t\."categoryId"/);
    expect(ticketQuery.sql).toMatch(/tc\.slug AS category/);
    expect(ticketQuery.sql).toMatch(/GROUP BY t\.id, tc\.id/);

    expect(result.version).toBe(CURRENT_VERSION);
    expect(result.tickets.map((t) => [t.id, t.category])).toEqual([['t-1', 'bug'], ['t-2', null]]);
    expect(result.categories).toEqual([
      { id: 'cat-1', originId: 'cat-1', name: 'Bug', slug: 'bug', color: 'red', createdAt: '2026-01-01T00:00:00.000Z' },
    ]);
  });

  it('lists tickets by ticket number so the import can keep their order', async () => {
    const qr = new FakeQueryRunner(answer);
    await new ExportWorkspace(dataSourceOf(qr)).execute('ws-1');

    const [ticketQuery] = qr.find(/FROM tickets t\s/);
    expect(ticketQuery.sql).toMatch(/ORDER BY t\."ticketNumber"/);
  });

  it('exports the audit category, level and source', async () => {
    const qr = new FakeQueryRunner((sql, params) => {
      if (/FROM audit_log_entries a/.test(sql)) {
        return [{ action: 'email-send-failed', entityType: 'email', entityId: 'e', userId: null, metadata: null, category: 'email', level: 'error', source: 'system', createdAt }];
      }
      return answer(sql, params);
    });
    const result = await new ExportWorkspace(dataSourceOf(qr)).execute('ws-1');

    expect(result.auditLog[0]).toMatchObject({ category: 'email', level: 'error', source: 'system', userEmail: null });
  });

  it('lists every referenced user with id and email and never exports a raw user id as an email', async () => {
    const member = '01MEMBER0000000000000000AA';
    const former = '01FORMER0000000000000000AA';
    const mentioned = '01MENTION000000000000000AA';
    const vanished = '01VANISHED00000000000000AA';
    const qr = new FakeQueryRunner((sql, params) => {
      if (/FROM workspace_members wm JOIN users u/.test(sql)) {
        return [{ id: member, email: 'agent@example.com', firstName: 'Agent', lastName: 'A', isActive: true, role: 'agent', organizationId: null }];
      }
      if (/FROM tickets t/.test(sql)) {
        return [{ id: 't-1', name: 'T', status: 'open', category: null, reporterId: member, tagIds: [], createdAt, updatedAt: createdAt }];
      }
      if (/FROM comments c/.test(sql)) {
        return [
          { id: 'c-1', content: `hi @[Mia](${mentioned})`, ticketId: 't-1', authorId: former, mentionedUserIds: mentioned, createdAt },
          { id: 'c-2', content: 'gone', ticketId: 't-1', authorId: vanished, mentionedUserIds: '', createdAt },
        ];
      }
      if (/FROM ticket_participants tp/.test(sql)) return [{ ticketId: 't-1', userId: vanished, role: 'follower' }];
      if (/FROM users WHERE id = ANY/.test(sql)) {
        const ids = params[0] as string[];
        return [
          { id: former, email: 'former@example.com', firstName: 'Former', lastName: 'F', isActive: false },
          { id: mentioned, email: 'mia@example.com', firstName: 'Mia', lastName: 'M' },
        ].filter((u) => ids.includes(u.id));
      }
      return answer(sql, params);
    });

    const result = await new ExportWorkspace(dataSourceOf(qr)).execute('ws-1');

    expect(qr.find(/FROM users WHERE id = ANY/)).toHaveLength(1);
    expect(result.users).toEqual([
      { id: member, email: 'agent@example.com', firstName: 'Agent', lastName: 'A', role: 'agent', isActive: true, organizationId: null },
      { id: former, email: 'former@example.com', firstName: 'Former', lastName: 'F', role: null, isActive: false },
      { id: mentioned, email: 'mia@example.com', firstName: 'Mia', lastName: 'M', role: null, isActive: true },
    ]);
    expect(result.comments.map((c) => [c.authorEmail, c.mentionedUserIds])).toEqual([
      ['former@example.com', [mentioned]],
      [null, []],
    ]);
    expect(result.participants[0].userEmail).toBeNull();
    const emails = JSON.stringify(result).match(/"[a-zA-Z]*[eE]mail":"[^"]*"/g) ?? [];
    for (const e of emails) expect(e).toMatch(/@/);
  });

  it('exports the branding text of the workspace', async () => {
    const qr = new FakeQueryRunner((sql, params) => {
      if (/FROM workspaces WHERE id/.test(sql)) {
        return [{ name: 'Acme', description: 'd', slaPolicy: null, metadata: { palette: 'teal' }, appName: 'Acme Desk', appSubtitle: 'Support' }];
      }
      return answer(sql, params);
    });
    const result = await new ExportWorkspace(dataSourceOf(qr)).execute('ws-1');

    expect(result.workspace).toEqual({
      name: 'Acme', description: 'd', slaPolicy: null, metadata: { palette: 'teal' }, appName: 'Acme Desk', appSubtitle: 'Support',
      logoFile: null, iconFile: null,
    });
  });

  it('exports live organizations, and the organization of members and tickets', async () => {
    const qr = new FakeQueryRunner((sql, params) => {
      if (/FROM organizations WHERE/.test(sql)) {
        return [{ id: 'org-1', name: 'Globex', description: null, notes: 'vip', domains: ['globex.com'], createdAt }];
      }
      if (/FROM workspace_members wm JOIN users u/.test(sql)) {
        return [{ id: 'u-1', email: 'a@example.com', firstName: 'A', lastName: 'A', isActive: true, role: 'user', organizationId: 'org-1' }];
      }
      if (/FROM tickets t/.test(sql)) {
        return [{ id: 't-1', name: 'T', status: 'open', category: null, reporterId: 'u-1', organizationId: 'org-1', tagIds: [], createdAt, updatedAt: createdAt }];
      }
      return answer(sql, params);
    });
    const result = await new ExportWorkspace(dataSourceOf(qr)).execute('ws-1');

    const [orgQuery] = qr.find(/FROM organizations WHERE/);
    expect(orgQuery.sql).toMatch(/"deletedAt" IS NULL/);
    expect(result.organizations).toEqual([
      { id: 'org-1', originId: 'org-1', name: 'Globex', description: null, notes: 'vip', domains: ['globex.com'], createdAt: '2026-01-01T00:00:00.000Z', logoFile: null },
    ]);
    expect(result.users[0].organizationId).toBe('org-1');
    expect(result.tickets[0].organizationId).toBe('org-1');
  });

  it('exports live departments with their members by email, and the department of tickets', async () => {
    const qr = new FakeQueryRunner((sql, params) => {
      if (/FROM departments WHERE/.test(sql)) return [{ id: 'd-1', name: 'Billing', description: 'money', createdAt }];
      if (/FROM department_members dm/.test(sql)) return [{ departmentId: 'd-1', userId: 'u-1' }, { departmentId: 'd-1', userId: 'u-gone' }];
      if (/FROM workspace_members wm JOIN users u/.test(sql)) {
        return [{ id: 'u-1', email: 'a@example.com', firstName: 'A', lastName: 'A', isActive: true, role: 'agent', organizationId: null }];
      }
      if (/FROM tickets t/.test(sql)) {
        return [{ id: 't-1', name: 'T', status: 'open', category: null, reporterId: 'u-1', departmentId: 'd-1', tagIds: [], createdAt, updatedAt: createdAt }];
      }
      return answer(sql, params);
    });
    const result = await new ExportWorkspace(dataSourceOf(qr)).execute('ws-1');

    expect(qr.find(/FROM departments WHERE/)[0].sql).toMatch(/"deletedAt" IS NULL/);
    expect(qr.find(/FROM department_members dm/)[0].sql).toMatch(/d\."deletedAt" IS NULL/);
    expect(result.departments).toEqual([
      { id: 'd-1', originId: 'd-1', name: 'Billing', description: 'money', memberEmails: ['a@example.com'], createdAt: '2026-01-01T00:00:00.000Z' },
    ]);
    expect(result.tickets[0].departmentId).toBe('d-1');
  });

  it('exports live projects with their category slugs, and the project of tickets', async () => {
    const qr = new FakeQueryRunner((sql, params) => {
      if (/FROM projects p/.test(sql)) return [{ id: 'p-1', name: 'Website', description: null, categorySlugs: ['bug'], createdAt }];
      if (/FROM tickets t/.test(sql)) {
        return [{ id: 't-1', name: 'T', status: 'open', category: null, reporterId: 'u-1', projectId: 'p-1', tagIds: [], createdAt, updatedAt: createdAt }];
      }
      return answer(sql, params);
    });
    const result = await new ExportWorkspace(dataSourceOf(qr)).execute('ws-1');

    const [projectQuery] = qr.find(/FROM projects p/);
    expect(projectQuery.sql).toMatch(/p\."deletedAt" IS NULL/);
    expect(projectQuery.sql).toMatch(/LEFT JOIN project_categories pc ON pc\."projectId" = p\.id/);
    expect(result.projects).toEqual([
      { id: 'p-1', originId: 'p-1', name: 'Website', description: null, categorySlugs: ['bug'], createdAt: '2026-01-01T00:00:00.000Z' },
    ]);
    expect(result.tickets[0].projectId).toBe('p-1');
  });

  it('exports the ticket source, registrar, origin date and description edit date, but not the mailbox', async () => {
    const origin = new Date('2025-12-31T00:00:00.000Z');
    const qr = new FakeQueryRunner((sql, params) => {
      if (/FROM tickets t/.test(sql)) {
        return [{
          id: 't-1', name: 'T', status: 'open', category: null, reporterId: 'u-1', tagIds: [], createdAt, updatedAt: createdAt,
          source: 'email', registeredById: 'u-agent', originDate: origin, descriptionEditedAt: createdAt,
        }];
      }
      if (/FROM users WHERE id = ANY/.test(sql)) return [{ id: 'u-agent', email: 'agent@example.com', firstName: 'Ag', lastName: 'E' }];
      return answer(sql, params);
    });
    const result = await new ExportWorkspace(dataSourceOf(qr)).execute('ws-1');

    expect(qr.find(/FROM tickets t/)[0].sql).not.toMatch(/mailboxId/);
    expect(result.tickets[0]).toMatchObject({
      source: 'email', registeredByEmail: 'agent@example.com',
      originDate: '2025-12-31T00:00:00.000Z', descriptionEditedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('exports description and comment edits of live tickets with the editor email', async () => {
    const qr = new FakeQueryRunner((sql, params) => {
      if (/FROM ticket_description_edits e/.test(sql)) return [{ ticketId: 't-1', content: 'old desc', editedById: 'u-1', createdAt }];
      if (/FROM comment_edits e/.test(sql)) return [{ commentId: 'c-1', content: 'old comment', editedById: 'u-gone', createdAt }];
      if (/FROM workspace_members wm JOIN users u/.test(sql)) {
        return [{ id: 'u-1', email: 'a@example.com', firstName: 'A', lastName: 'A', isActive: true, role: 'agent', organizationId: null }];
      }
      return answer(sql, params);
    });
    const result = await new ExportWorkspace(dataSourceOf(qr)).execute('ws-1');

    for (const table of ['ticket_description_edits', 'comment_edits']) {
      const [query] = qr.find(new RegExp(`FROM ${table} e`));
      expect(query.sql).toMatch(/t\."workspaceId" = \$1 AND t\."deletedAt" IS NULL/);
    }
    expect(result.descriptionEdits).toEqual([{ ticketId: 't-1', content: 'old desc', editedByEmail: 'a@example.com', createdAt: '2026-01-01T00:00:00.000Z' }]);
    expect(result.commentEdits).toEqual([{ commentId: 'c-1', content: 'old comment', editedByEmail: null, createdAt: '2026-01-01T00:00:00.000Z' }]);
  });

  it('exports KB categories and articles with the author email', async () => {
    const qr = new FakeQueryRunner((sql, params) => {
      if (/FROM kb_categories WHERE/.test(sql)) return [{ id: 'kc-1', name: 'Start', slug: 'start', icon: 'book', position: 0, createdAt }];
      if (/FROM kb_articles WHERE/.test(sql)) {
        return [{ id: 'ka-1', title: 'Hello', slug: 'hello', content: '<p>Hi</p>', status: 'published', position: 1, categoryId: 'kc-1', createdById: 'u-1', createdAt, updatedAt: createdAt }];
      }
      if (/FROM workspace_members wm JOIN users u/.test(sql)) {
        return [{ id: 'u-1', email: 'a@example.com', firstName: 'A', lastName: 'A', isActive: true, role: 'agent', organizationId: null }];
      }
      return answer(sql, params);
    });
    const result = await new ExportWorkspace(dataSourceOf(qr)).execute('ws-1');

    expect(result.kbCategories).toEqual([{ id: 'kc-1', originId: 'kc-1', name: 'Start', slug: 'start', icon: 'book', position: 0, createdAt: '2026-01-01T00:00:00.000Z' }]);
    expect(result.kbArticles).toEqual([{
      id: 'ka-1', originId: 'ka-1', title: 'Hello', slug: 'hello', content: '<p>Hi</p>', status: 'published', position: 1, categoryId: 'kc-1',
      createdByEmail: 'a@example.com', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    }]);
  });

  it('carries as origin id the source id of an imported entity, the earliest link winning, and its own id otherwise', async () => {
    const qr = new FakeQueryRunner((sql, params) => {
      if (/FROM workspace_import_links/.test(sql)) {
        return [
          { entityType: 'ticket', sourceId: 'src-first', targetId: 't-1' },
          { entityType: 'ticket', sourceId: 'src-later', targetId: 't-1' },
          // Same id, other type: does not apply to the ticket t-2
          { entityType: 'comment', sourceId: 'src-c', targetId: 't-2' },
          { entityType: 'ticket-category', sourceId: 'src-cat', targetId: 'cat-1' },
          { entityType: 'ticket-description-edit', sourceId: 'src-e', targetId: 'e-1' },
        ];
      }
      if (/FROM ticket_description_edits e/.test(sql)) return [{ id: 'e-1', ticketId: 't-1', content: 'old', editedById: 'u-1', createdAt }];
      if (/FROM comment_edits e/.test(sql)) return [{ id: 'ce-1', commentId: 'c-1', content: 'old', editedById: 'u-1', createdAt }];
      return answer(sql, params);
    });
    const result = await new ExportWorkspace(dataSourceOf(qr)).execute('ws-1');

    const [linkQuery] = qr.find(/FROM workspace_import_links/);
    expect(linkQuery.params).toEqual(['ws-1']);
    expect(linkQuery.sql).toMatch(/ORDER BY "createdAt", id/);
    expect(result.tickets.map((t) => [t.id, t.originId])).toEqual([['t-1', 'src-first'], ['t-2', 't-2']]);
    expect(result.categories[0].originId).toBe('src-cat');
    expect(result.descriptionEdits[0]).toMatchObject({ id: 'e-1', originId: 'src-e' });
    expect(result.commentEdits[0]).toMatchObject({ id: 'ce-1', originId: 'ce-1' });
  });

  it('scopes the categories query to the exported workspace', async () => {
    const qr = new FakeQueryRunner(answer);
    await new ExportWorkspace(dataSourceOf(qr)).execute('ws-1');

    const [categoriesQuery] = qr.find(/FROM ticket_categories WHERE/);
    expect(categoriesQuery.sql).toMatch(/"workspaceId" = \$1/);
    expect(categoriesQuery.params).toEqual(['ws-1']);
  });
});

describe('ImportWorkspace', () => {
  const answer: Answer = (sql) => {
    if (/FROM users WHERE email = ANY/.test(sql)) return [{ id: 'u-1', email: 'alice@example.com' }];
    if (/FROM ticket_categories WHERE/.test(sql)) return [{ id: 'cat-existing', slug: 'bug' }];
    if (/MAX\("ticketNumber"\)/.test(sql)) return [{ max: 0 }];
    return [];
  };

  it('maps category slugs to the target workspace categoryId, creating the ones it lacks', async () => {
    const qr = new FakeQueryRunner(answer);
    const data = emptyExport({
      users: [{ email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' }],
      categories: [
        { id: 'c-bug', name: 'Bug', slug: 'bug', color: 'red', createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'c-feat', name: 'Feature Request', slug: 'feature-request', color: 'green', createdAt: '2026-01-01T00:00:00.000Z' },
      ],
      tickets: [ticket('t-1', 'bug'), ticket('t-2', 'feature-request'), ticket('t-3', null)],
    });

    const { result } = await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    const categoryInserts = qr.find(/INSERT INTO ticket_categories/);
    expect(categoryInserts).toHaveLength(1);
    const [newCategoryId, name, slug, color, workspaceId] = categoryInserts[0].params as string[];
    expect([name, slug, color, workspaceId]).toEqual(['Feature Request', 'feature-request', 'green', 'ws-target']);

    const ticketInserts = qr.find(/INSERT INTO tickets/);
    expect(ticketInserts).toHaveLength(3);
    for (const insert of ticketInserts) {
      expect(insert.sql).toMatch(/"categoryId"/);
      expect(insert.sql).not.toMatch(/status, category,/);
    }
    expect(ticketInserts.map((q) => q.params[5])).toEqual(['cat-existing', newCategoryId, null]);

    expect(result.categoriesImported).toBe(1);
    expect(result.ticketsImported).toBe(3);
    expect(qr.committed).toBe(true);
    expect(qr.rolledBack).toBe(false);
  });

  it('imports audit entries without a user (system or portal events) instead of failing', async () => {
    const qr = new FakeQueryRunner(answer);
    const data = emptyExport({
      users: [{ email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' }],
      auditLog: [
        { action: 'portal-ticket-created', entityType: 'ticket', entityId: 'x', userEmail: null, metadata: null, createdAt: '2026-01-01T00:00:00.000Z' },
        { action: 'ticket-created', entityType: 'ticket', entityId: 'y', userEmail: 'alice@example.com', metadata: null, createdAt: '2026-01-01T00:00:00.000Z' },
      ],
    });

    const { result } = await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    expect(qr.find(/INSERT INTO users/)).toHaveLength(0);
    const auditInserts = qr.find(/INSERT INTO audit_log_entries/);
    expect(auditInserts.map((q) => q.params[4])).toEqual([null, 'u-1']);
    expect(result.auditLogImported).toBe(2);
    expect(qr.committed).toBe(true);
  });

  it('does not import the same audit entries twice', async () => {
    const createdAt = '2026-01-01T00:00:00.000Z';
    const qr = new FakeQueryRunner((sql, params) => {
      if (/FROM audit_log_entries WHERE/.test(sql)) return [{ action: 'ticket-created', entityType: 'ticket', userId: 'u-1', createdAt }];
      return answer(sql, params);
    });
    const data = emptyExport({
      users: [{ email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' }],
      auditLog: [
        { action: 'ticket-created', entityType: 'ticket', entityId: 'y', userEmail: 'alice@example.com', metadata: null, createdAt },
        { action: 'ticket-updated', entityType: 'ticket', entityId: 'y', userEmail: 'alice@example.com', metadata: null, createdAt },
      ],
    });

    const { result } = await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    expect(qr.find(/INSERT INTO audit_log_entries/).map((q) => q.params[1])).toEqual(['ticket-updated']);
    expect(result.auditLogImported).toBe(1);
  });

  it('takes the ticket-number advisory lock of the target workspace before reading MAX and keeps the original order', async () => {
    const qr = new FakeQueryRunner((sql, params) => {
      if (/MAX\("ticketNumber"\)/.test(sql)) return [{ max: 41 }];
      return answer(sql, params);
    });
    const second = { ...ticket('t-2', null), ticketNumber: 2 };
    const first = { ...ticket('t-1', null), ticketNumber: 1 };
    const data = emptyExport({
      users: [{ email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' }],
      tickets: [second, first],
    });

    await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    const lockIndex = qr.queries.findIndex((q) => /pg_advisory_xact_lock\(hashtext\(\$1\)\)/.test(q.sql));
    const maxIndex = qr.queries.findIndex((q) => /MAX\("ticketNumber"\)/.test(q.sql));
    expect(lockIndex).toBeGreaterThanOrEqual(0);
    expect(qr.queries[lockIndex].params).toEqual(['ws-target']);
    expect(lockIndex).toBeLessThan(maxIndex);

    const inserts = qr.find(/INSERT INTO tickets/);
    expect(inserts.map((q) => [q.params[1], q.params[9]])).toEqual([['Ticket t-1', 42], ['Ticket t-2', 43]]);
  });

  it('counts only the participants actually inserted, not the ones ON CONFLICT skipped', async () => {
    let calls = 0;
    const qr = new FakeQueryRunner((sql, params) => {
      if (/INSERT INTO ticket_participants/.test(sql)) return calls++ === 0 ? [{ id: 'p-new' }] : [];
      return answer(sql, params);
    });
    const data = emptyExport({
      users: [{ email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' }],
      tickets: [ticket('t-1', null)],
      participants: [
        { ticketId: 't-1', userEmail: 'alice@example.com', role: 'follower' },
        { ticketId: 't-1', userEmail: 'alice@example.com', role: 'collaborator' },
      ],
    });

    const { result } = await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    expect(qr.find(/INSERT INTO ticket_participants[\s\S]*RETURNING id/)).toHaveLength(2);
    expect(result.participantsImported).toBe(1);
  });

  it('does not duplicate canned responses whose title the target workspace already has', async () => {
    const qr = new FakeQueryRunner((sql, params) => {
      if (/FROM canned_responses WHERE/.test(sql)) return [{ id: 'cr-existing', title: 'Greeting' }];
      return answer(sql, params);
    });
    const createdAt = '2026-01-01T00:00:00.000Z';
    const data = emptyExport({
      cannedResponses: [
        { id: 'cr-1', title: 'Greeting', content: 'Hello', createdAt },
        { id: 'cr-2', title: 'Closing', content: 'Bye', createdAt },
        { id: 'cr-3', title: 'Closing', content: 'Bye again', createdAt },
      ],
    });

    const { result } = await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    expect(qr.find(/INSERT INTO canned_responses/).map((q) => q.params[1])).toEqual(['Closing']);
    expect(result.cannedResponsesImported).toBe(1);
  });

  it('creates custom field definitions before tickets and rewrites ticket values to the new definition ids', async () => {
    const qr = new FakeQueryRunner(answer);
    const createdAt = '2026-01-01T00:00:00.000Z';
    const data = emptyExport({
      users: [{ email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' }],
      customFields: [
        { id: 'cf-plan', name: 'Plan', type: 'select', options: ['free', 'pro'], position: 0, required: false, createdAt },
        { id: 'cf-note', name: 'Note', type: 'text', options: null, position: 1, required: false, createdAt },
      ],
      tickets: [{ ...ticket('t-1', null), customFields: { 'cf-plan': 'pro', 'cf-note': 'hi', 'cf-gone': 'x' } }],
    });

    const { result } = await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    const fieldInserts = qr.find(/INSERT INTO custom_field_definitions/);
    expect(fieldInserts).toHaveLength(2);
    const [planId, , , planOptions] = fieldInserts[0].params as string[];
    const [noteId, , , noteOptions] = fieldInserts[1].params as (string | null)[];
    expect(planOptions).toBe('["free","pro"]');
    expect(noteOptions).toBeNull();

    const fieldsIndex = qr.queries.indexOf(fieldInserts[0]);
    const [ticketInsert] = qr.find(/INSERT INTO tickets/);
    expect(fieldsIndex).toBeLessThan(qr.queries.indexOf(ticketInsert));
    expect(JSON.parse(ticketInsert.params[10] as string)).toEqual({ [planId]: 'pro', [noteId as string]: 'hi' });
    expect(result.customFieldsImported).toBe(2);
  });

  it('reuses a custom field definition with the same name and type instead of duplicating it', async () => {
    const qr = new FakeQueryRunner((sql, params) => {
      if (/FROM custom_field_definitions WHERE/.test(sql)) return [{ id: 'cf-existing', name: 'Plan', type: 'select' }];
      return answer(sql, params);
    });
    const data = emptyExport({
      users: [{ email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' }],
      customFields: [
        { id: 'cf-plan', name: 'Plan', type: 'select', options: ['free'], position: 0, required: false, createdAt: '2026-01-01T00:00:00.000Z' },
      ],
      tickets: [{ ...ticket('t-1', null), customFields: { 'cf-plan': 'free' } }],
    });

    const { result } = await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    expect(qr.find(/INSERT INTO custom_field_definitions/)).toHaveLength(0);
    const [ticketInsert] = qr.find(/INSERT INTO tickets/);
    expect(JSON.parse(ticketInsert.params[10] as string)).toEqual({ 'cf-existing': 'free' });
    expect(result.customFieldsImported).toBe(0);
  });

  it('carries the audit category, level and source, and falls back to the column defaults when absent', async () => {
    const qr = new FakeQueryRunner(answer);
    const createdAt = '2026-01-01T00:00:00.000Z';
    const data = emptyExport({
      auditLog: [
        { action: 'email-send-failed', entityType: 'email', entityId: 'e', userEmail: null, metadata: null, category: 'email', level: 'error', source: 'system', createdAt },
        { action: 'ticket-created', entityType: 'ticket', entityId: 't', userEmail: null, metadata: null, createdAt: '2026-01-02T00:00:00.000Z' },
      ],
    });

    await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    const inserts = qr.find(/INSERT INTO audit_log_entries/);
    expect(inserts[0].sql).toMatch(/category, level, source/);
    expect(inserts.map((q) => q.params.slice(7, 10))).toEqual([['email', 'error', 'system'], ['ticket', 'info', null]]);
  });

  it('imports a 1.13.0 file, which has no audit category, level or source', async () => {
    const qr = new FakeQueryRunner(answer);
    const data = emptyExport({
      version: '1.13.0',
      users: [{ email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' }],
      tickets: [ticket('t-1', null)],
      auditLog: [{ action: 'ticket-created', entityType: 'ticket', entityId: 't-1', userEmail: 'alice@example.com', metadata: null, createdAt: '2026-01-01T00:00:00.000Z' }],
    });

    const { result } = await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    expect(result.ticketsImported).toBe(1);
    expect(result.auditLogImported).toBe(1);
    expect(qr.committed).toBe(true);
  });

  it('names non-member users without adding or inviting them, and skips a comment whose author no longer exists', async () => {
    const qr = new FakeQueryRunner(answer);
    const createdAt = '2026-01-01T00:00:00.000Z';
    const data = emptyExport({
      users: [
        { id: 'src-alice', email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' },
        { id: 'src-former', email: 'former@example.com', firstName: 'Former', lastName: 'F', role: null },
      ],
      tickets: [ticket('t-1', null)],
      comments: [
        { id: 'c-1', content: 'kept', ticketId: 't-1', authorEmail: 'former@example.com', mentionedUserIds: [], createdAt },
        { id: 'c-2', content: 'orphan', ticketId: 't-1', authorEmail: null, mentionedUserIds: [], createdAt },
      ],
      participants: [{ ticketId: 't-1', userEmail: null, role: 'follower' }],
    });

    const { result, newMembers } = await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    const [userInsert] = qr.find(/INSERT INTO users/);
    expect(userInsert.params.slice(1)).toEqual(['former@example.com', expect.any(String), 'Former', 'F', true, true]);
    expect(newMembers).toEqual([]);
    expect(qr.find(/INSERT INTO workspace_members/).map((q) => q.params[2])).toEqual(['u-1']);
    expect(qr.find(/INSERT INTO comments/).map((q) => q.params[1])).toEqual(['kept']);
    expect(result.commentsImported).toBe(1);
    expect(result.commentsSkipped).toBe(1);
    expect(result.participantsImported).toBe(0);
  });

  it('keeps a member deactivated in the source deactivated, with membership and history, and does not invite them', async () => {
    const qr = new FakeQueryRunner(answer);
    const data = emptyExport({
      users: [
        { id: 'src-alice', email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' },
        { id: 'src-gone', email: 'gone@example.com', firstName: 'Gone', lastName: 'G', role: 'agent', isActive: false },
        { id: 'src-new', email: 'new@example.com', firstName: 'New', lastName: 'N', role: 'agent', isActive: true },
      ],
      tickets: [{ ...ticket('t-1', null), assigneeEmail: 'gone@example.com' }],
      comments: [{ id: 'c-1', content: 'by gone', ticketId: 't-1', authorEmail: 'gone@example.com', mentionedUserIds: [], createdAt: '2026-01-01T00:00:00.000Z' }],
    });

    const { result, newMembers } = await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    const userInserts = qr.find(/INSERT INTO users/);
    expect(userInserts.map((q) => [q.params[1], q.params[5]])).toEqual([
      ['gone@example.com', false],
      ['new@example.com', true],
    ]);
    const goneId = userInserts[0].params[0];
    expect(newMembers.map((m) => m.email)).toEqual(['new@example.com']);
    expect(qr.find(/INSERT INTO workspace_members/).map((q) => [q.params[2], q.params[3]])).toContainEqual([goneId, 'agent']);
    expect(qr.find(/INSERT INTO tickets/)[0].params[8]).toBe(goneId);
    expect(qr.find(/INSERT INTO comments/)[0].params[3]).toBe(goneId);
    expect(result.commentsSkipped).toBe(0);
  });

  it('rejects a user whose isActive is not a boolean', async () => {
    const qr = new FakeQueryRunner(answer);
    const data = emptyExport({ users: [{ email: 'a@example.com', firstName: 'A', lastName: 'A', role: 'agent', isActive: 'no' as unknown as boolean }] });
    await expect(new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data))
      .rejects.toThrow('Invalid export file: users[0].isActive must be true, false or absent');
  });

  it('rewrites mention ids and markup to target users and degrades unknown mentions to plain text', async () => {
    const qr = new FakeQueryRunner((sql, params) => {
      if (/FROM users WHERE email = ANY/.test(sql)) {
        return [{ id: 'u-1', email: 'alice@example.com' }, { id: 'u-bob', email: 'bob@example.com' }];
      }
      if (/FROM users WHERE id = ANY/.test(sql)) return (params[0] as string[]).includes('local-carol') ? [{ id: 'local-carol' }] : [];
      return answer(sql, params);
    });
    const data = emptyExport({
      users: [
        { id: 'src-alice', email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' },
        { id: 'src-bob', email: 'bob@example.com', firstName: 'Bob', lastName: 'B', role: null },
      ],
      tickets: [ticket('t-1', null)],
      comments: [{
        id: 'c-1',
        content: 'cc @[Bob B](src-bob), @[Carol](local-carol) and @[Ghost](src-ghost)',
        ticketId: 't-1',
        authorEmail: 'alice@example.com',
        mentionedUserIds: ['src-bob', 'local-carol', 'src-ghost'],
        createdAt: '2026-01-01T00:00:00.000Z',
      }],
    });

    await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    const [lookup] = qr.find(/FROM users WHERE id = ANY/);
    expect((lookup.params[0] as string[]).sort()).toEqual(['local-carol', 'src-ghost']);
    const [commentInsert] = qr.find(/INSERT INTO comments/);
    expect(commentInsert.params[1]).toBe('cc @[Bob B](u-bob), @[Carol](local-carol) and @Ghost');
    expect(commentInsert.params[4]).toBe('u-bob,local-carol');
  });

  it('points audit entries and their metadata at the ids the import created, keeping ids of entities it does not carry', async () => {
    const qr = new FakeQueryRunner((sql, params) => {
      if (/FROM users WHERE email = ANY/.test(sql)) return [{ id: 'u-1', email: 'alice@example.com' }, { id: 'u-bob', email: 'bob@example.com' }];
      if (/FROM tags WHERE/.test(sql)) return [{ id: 'tag-existing', name: 'vip' }];
      return answer(sql, params);
    });
    const at = (n: number) => `2026-01-01T00:00:0${n}.000Z`;
    const data = emptyExport({
      users: [
        { id: 'src-alice', email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' },
        { id: 'src-bob', email: 'bob@example.com', firstName: 'Bob', lastName: 'B', role: 'agent' },
      ],
      tags: [{ id: 'src-tag', name: 'vip', color: null, createdAt: at(0) }],
      categories: [{ id: 'src-cat', name: 'Bug', slug: 'bug', color: 'red', createdAt: at(0) }],
      customFields: [{ id: 'src-cf', name: 'Plan', type: 'text', options: null, position: 0, required: false, createdAt: at(0) }],
      cannedResponses: [{ id: 'src-cr', title: 'Hi', content: 'Hello', createdAt: at(0) }],
      tickets: [ticket('src-t', 'bug')],
      comments: [{ id: 'src-c', content: 'x', ticketId: 'src-t', authorEmail: 'alice@example.com', mentionedUserIds: [], createdAt: at(0) }],
      attachments: [{ id: 'src-a', fileName: 'f', originalName: 'f', mimeType: 'text/plain', size: 1, file: 'files/a', ticketId: 'src-t', commentId: null, uploadedByEmail: null, createdAt: at(0) }],
      csatResponses: [{ id: 'src-csat', ticketId: 'src-t', rating: 5, respondedAt: null, createdAt: at(0) }],
      auditLog: [
        ['ticket', 'src-t'], ['comment', 'src-c'], ['attachment', 'src-a'], ['tag', 'src-tag'],
        ['ticket-category', 'src-cat'], ['custom-field', 'src-cf'], ['canned-response', 'src-cr'],
        ['csat', 'src-csat'], ['user', 'src-bob'], ['workspace', 'src-ws'], ['department', 'src-dept'],
      ].map(([entityType, entityId], i) => ({
        action: `action-${i}`, entityType, entityId, userEmail: 'alice@example.com',
        metadata: i === 0 ? { ticketId: 'src-t', commentId: 'src-c', targetUserId: 'src-bob', departmentId: 'src-dept', name: 'n' } : null,
        createdAt: at(1),
      })),
    });

    await new ImportWorkspace(dataSourceOf(qr), new FakeS3Storage())
      .execute('ws-target', data, { files: archiveOf({ 'files/a': Buffer.from('x') }) });

    const idOf = (table: string) => qr.find(new RegExp(`INSERT INTO ${table}`))[0].params[0];
    const audit = qr.find(/INSERT INTO audit_log_entries/);
    expect(audit.map((q) => [q.params[2], q.params[3]])).toEqual([
      ['ticket', idOf('tickets')],
      ['comment', idOf('comments')],
      ['attachment', idOf('attachments')],
      ['tag', 'tag-existing'],
      ['ticket-category', 'cat-existing'],
      ['custom-field', idOf('custom_field_definitions')],
      ['canned-response', idOf('canned_responses')],
      ['csat', idOf('csat_responses')],
      ['user', 'u-bob'],
      ['workspace', 'ws-target'],
      ['department', 'src-dept'],
    ]);
    expect(JSON.parse(audit[0].params[6] as string)).toEqual({
      ticketId: idOf('tickets'), commentId: idOf('comments'), targetUserId: 'u-bob', departmentId: 'src-dept', name: 'n',
    });
  });

  it('anchors audit entries of a ticket skipped as already imported to the existing ticket', async () => {
    const qr = new FakeQueryRunner((sql, params) => {
      if (/SELECT id, name, "reporterId", "createdAt" FROM tickets/.test(sql)) {
        return [{ id: 'existing-t', name: 'Ticket src-t', reporterId: 'u-1', createdAt: '2026-01-01T00:00:00.000Z' }];
      }
      return answer(sql, params);
    });
    const data = emptyExport({
      users: [{ email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' }],
      tickets: [ticket('src-t', null)],
      auditLog: [{ action: 'ticket-created', entityType: 'ticket', entityId: 'src-t', userEmail: null, metadata: null, createdAt: '2026-01-01T00:00:00.000Z' }],
    });

    await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    expect(qr.find(/INSERT INTO tickets/)).toHaveLength(0);
    expect(qr.find(/INSERT INTO audit_log_entries/)[0].params[3]).toBe('existing-t');
  });

  it('reports tickets left alone because they already exist, and only the files they carried', async () => {
    const qr = new FakeQueryRunner((sql, params) => {
      if (/SELECT id, name, "reporterId", "createdAt" FROM tickets/.test(sql)) {
        return [{ id: 'existing-t', name: 'Ticket src-t', reporterId: 'u-1', createdAt: '2026-01-01T00:00:00.000Z' }];
      }
      return answer(sql, params);
    });
    const attachment = (id: string, ticketId: string, file: string | null) => ({
      id, ticketId, commentId: null, fileName: 'f.txt', originalName: 'f.txt', mimeType: 'text/plain', size: 1, uploadedByEmail: null, createdAt: '2026-01-01T00:00:00.000Z', file,
    });
    const data = emptyExport({
      users: [{ email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' }],
      tickets: [ticket('src-t', null), { ...ticket('new-t', null), name: 'Something new' }],
      attachments: [attachment('a-1', 'src-t', 'files/a-1'), attachment('a-2', 'src-t', null), attachment('a-3', 'new-t', null)] as any,
    });

    const { result } = await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    expect(result).toMatchObject({ ticketsImported: 1, ticketsAlreadyPresent: 1, attachmentsOfExistingTickets: 1, attachmentsSkipped: 1 });
  });

  it('upgrades a 1.12 file that only carries slugs on tickets and derives a category name from the slug', async () => {
    const qr = new FakeQueryRunner(answer);
    const legacy = emptyExport({
      version: '1.12.0',
      users: [{ email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' }],
      tickets: [ticket('t-1', 'feature-request')],
    });
    delete (legacy as Partial<WorkspaceExportData>).categories;

    await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', legacy);

    const [categoryInsert] = qr.find(/INSERT INTO ticket_categories/);
    expect(categoryInsert).toBeDefined();
    const [newCategoryId, name, slug, color] = categoryInsert.params as string[];
    expect([name, slug, color]).toEqual(['Feature Request', 'feature-request', 'blue']);

    const [ticketInsert] = qr.find(/INSERT INTO tickets/);
    expect(ticketInsert.params[5]).toBe(newCategoryId);
  });
});

describe('ImportWorkspace organizations', () => {
  const at = '2026-01-01T00:00:00.000Z';
  const org = (id: string, name: string) => ({ id, name, description: null, notes: 'n', domains: ['x.com'], createdAt: at });

  it('creates organizations before members and tickets, reusing one with the same name, and remaps both', async () => {
    const qr = new FakeQueryRunner((sql) => {
      if (/FROM users WHERE email = ANY/.test(sql)) return [{ id: 'u-1', email: 'alice@example.com' }];
      if (/FROM organizations WHERE/.test(sql)) return [{ id: 'org-existing', name: 'Globex' }];
      if (/MAX\("ticketNumber"\)/.test(sql)) return [{ max: 0 }];
      return [];
    });
    const data = emptyExport({
      organizations: [org('src-globex', 'Globex'), org('src-initech', 'Initech')],
      users: [
        { id: 'src-alice', email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'user', organizationId: 'src-globex' },
        { id: 'src-bob', email: 'bob@example.com', firstName: 'Bob', lastName: 'B', role: 'user', organizationId: 'src-initech' },
      ],
      tickets: [{ ...ticket('t-1', null), organizationId: 'src-initech' }, { ...ticket('t-2', null), organizationId: 'src-gone' }],
      auditLog: [{ action: 'organization-created', entityType: 'organization', entityId: 'src-initech', userEmail: null, metadata: { organizationId: 'src-globex' }, createdAt: at }],
    });

    const { result } = await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    const orgInserts = qr.find(/INSERT INTO organizations/);
    expect(orgInserts).toHaveLength(1);
    const [initechId, name, , notes, domains, workspaceId] = orgInserts[0].params as string[];
    expect([name, notes, domains, workspaceId]).toEqual(['Initech', 'n', '["x.com"]', 'ws-target']);
    expect(orgInserts[0].sql).not.toMatch(/logo/);

    const memberInserts = qr.find(/INSERT INTO workspace_members/);
    expect(qr.queries.indexOf(orgInserts[0])).toBeLessThan(qr.queries.indexOf(memberInserts[0]));
    expect(memberInserts.map((q) => q.params[4])).toEqual(['org-existing', initechId]);
    expect(qr.find(/INSERT INTO tickets/).map((q) => q.params[20])).toEqual([initechId, null]);

    const [audit] = qr.find(/INSERT INTO audit_log_entries/);
    expect(audit.params[3]).toBe(initechId);
    expect(JSON.parse(audit.params[6] as string)).toEqual({ organizationId: 'org-existing' });
    expect(result.organizationsImported).toBe(1);
  });

  it('gives an existing member the imported organization only when it has none', async () => {
    const qr = new FakeQueryRunner((sql) => {
      if (/FROM users WHERE email = ANY/.test(sql)) return [{ id: 'u-1', email: 'alice@example.com' }];
      if (/SELECT 1 FROM workspace_members/.test(sql)) return [{ '?column?': 1 }];
      if (/MAX\("ticketNumber"\)/.test(sql)) return [{ max: 0 }];
      return [];
    });
    const data = emptyExport({
      organizations: [org('src-globex', 'Globex')],
      users: [{ id: 'src-alice', email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'user', organizationId: 'src-globex' }],
    });

    await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    expect(qr.find(/INSERT INTO workspace_members/)).toHaveLength(0);
    const [update] = qr.find(/UPDATE workspace_members/);
    expect(update.sql).toMatch(/AND "organizationId" IS NULL/);
    expect(update.params).toEqual(['ws-target', 'u-1', qr.find(/INSERT INTO organizations/)[0].params[0]]);
  });

  it('rejects an organization without a name', async () => {
    const qr = new FakeQueryRunner(() => []);
    await expect(new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', emptyExport({ organizations: [org('o', ' ')] })))
      .rejects.toThrow('Invalid export file: organizations[0].name is required');
  });
});

describe('ImportWorkspace departments', () => {
  const at = '2026-01-01T00:00:00.000Z';

  it('reuses a department by name, creates the rest with their members, and remaps tickets and audit', async () => {
    const qr = new FakeQueryRunner((sql) => {
      if (/FROM users WHERE email = ANY/.test(sql)) return [{ id: 'u-1', email: 'alice@example.com' }];
      if (/FROM departments WHERE/.test(sql)) return [{ id: 'dept-existing', name: 'Billing' }];
      if (/MAX\("ticketNumber"\)/.test(sql)) return [{ max: 0 }];
      return [];
    });
    const data = emptyExport({
      users: [{ id: 'src-alice', email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'agent' }],
      departments: [
        { id: 'src-billing', name: 'Billing', description: null, memberEmails: ['alice@example.com'], createdAt: at },
        { id: 'src-tech', name: 'Tech', description: 'Tech team', memberEmails: ['alice@example.com', 'carl@example.com'], createdAt: at },
      ],
      tickets: [{ ...ticket('t-1', null), departmentId: 'src-tech' }, { ...ticket('t-2', null), departmentId: 'src-deleted' }],
      auditLog: [{ action: 'department-created', entityType: 'department', entityId: 'src-tech', userEmail: null, metadata: { departmentId: 'src-billing' }, createdAt: at }],
    });

    const { result } = await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    const deptInserts = qr.find(/INSERT INTO departments/);
    expect(deptInserts.map((q) => q.params.slice(1, 4))).toEqual([['Tech', 'Tech team', 'ws-target']]);
    const techId = deptInserts[0].params[0];
    const carlId = qr.find(/INSERT INTO users/).find((q) => q.params[1] === 'carl@example.com')!.params[0];
    const memberInserts = qr.find(/INSERT INTO department_members/);
    expect(memberInserts[0].sql).toMatch(/ON CONFLICT DO NOTHING/);
    expect(memberInserts.map((q) => q.params.slice(1))).toEqual([
      ['dept-existing', 'u-1'], [techId, 'u-1'], [techId, carlId],
    ]);
    expect(qr.find(/INSERT INTO tickets/).map((q) => q.params[21])).toEqual([techId, null]);
    const [audit] = qr.find(/INSERT INTO audit_log_entries/);
    expect(audit.params[3]).toBe(techId);
    expect(JSON.parse(audit.params[6] as string)).toEqual({ departmentId: 'dept-existing' });
    expect(result.departmentsImported).toBe(1);
  });

  it('rejects a department whose members are not a list of emails', async () => {
    const qr = new FakeQueryRunner(() => []);
    const data = emptyExport({ departments: [{ id: 'd', name: 'D', description: null, memberEmails: [''], createdAt: at }] });
    await expect(new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data))
      .rejects.toThrow('Invalid export file: departments[0].memberEmails must be a list of emails');
  });
});

describe('ImportWorkspace projects', () => {
  const at = '2026-01-01T00:00:00.000Z';

  it('reuses a project by name, creates the rest, links categories by slug and remaps tickets and audit', async () => {
    const qr = new FakeQueryRunner((sql) => {
      if (/FROM users WHERE email = ANY/.test(sql)) return [{ id: 'u-1', email: 'alice@example.com' }];
      if (/FROM ticket_categories WHERE/.test(sql)) return [{ id: 'cat-existing', slug: 'bug' }];
      if (/FROM projects WHERE/.test(sql)) return [{ id: 'proj-existing', name: 'Website' }];
      if (/MAX\("ticketNumber"\)/.test(sql)) return [{ max: 0 }];
      return [];
    });
    const data = emptyExport({
      users: [{ email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' }],
      categories: [{ id: 'c-feat', name: 'Feature', slug: 'feature', color: 'green', createdAt: at }],
      projects: [
        { id: 'src-web', name: 'Website', description: null, categorySlugs: ['bug'], createdAt: at },
        { id: 'src-app', name: 'App', description: 'Mobile', categorySlugs: ['bug', 'feature'], createdAt: at },
      ],
      tickets: [{ ...ticket('t-1', null), projectId: 'src-app' }, { ...ticket('t-2', null), projectId: 'src-web' }],
      auditLog: [{ action: 'project-created', entityType: 'project', entityId: 'src-app', userEmail: null, metadata: { projectId: 'src-web' }, createdAt: at }],
    });

    const { result } = await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    const [featureInsert] = qr.find(/INSERT INTO ticket_categories/);
    const projectInserts = qr.find(/INSERT INTO projects/);
    expect(projectInserts.map((q) => q.params.slice(1, 4))).toEqual([['App', 'Mobile', 'ws-target']]);
    expect(qr.queries.indexOf(featureInsert)).toBeLessThan(qr.queries.indexOf(projectInserts[0]));
    const appId = projectInserts[0].params[0];
    expect(qr.find(/INSERT INTO project_categories/).map((q) => q.params)).toEqual([
      ['proj-existing', 'cat-existing'], [appId, 'cat-existing'], [appId, featureInsert.params[0]],
    ]);
    expect(qr.find(/INSERT INTO tickets/).map((q) => q.params[22])).toEqual([appId, 'proj-existing']);
    const [audit] = qr.find(/INSERT INTO audit_log_entries/);
    expect(audit.params[3]).toBe(appId);
    expect(JSON.parse(audit.params[6] as string)).toEqual({ projectId: 'proj-existing' });
    expect(result.projectsImported).toBe(1);
  });
});

describe('ImportWorkspace ticket fields', () => {
  const answer: Answer = (sql) => {
    if (/FROM users WHERE email = ANY/.test(sql)) return [{ id: 'u-1', email: 'alice@example.com' }];
    if (/MAX\("ticketNumber"\)/.test(sql)) return [{ max: 0 }];
    return [];
  };

  it('carries source, registrar, origin date and description edit date, leaving the mailbox empty', async () => {
    const qr = new FakeQueryRunner(answer);
    const data = emptyExport({
      users: [{ email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' }],
      tickets: [{
        ...ticket('t-1', null), source: 'portal', registeredByEmail: 'alice@example.com',
        originDate: '2025-12-31T00:00:00.000Z', descriptionEditedAt: '2026-01-02T00:00:00.000Z',
      }],
    });

    await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    const [insert] = qr.find(/INSERT INTO tickets/);
    expect(insert.sql).toMatch(/source, "registeredById", "originDate", "descriptionEditedAt"/);
    expect(insert.sql).not.toMatch(/mailboxId/);
    expect(insert.params.slice(23)).toEqual(['portal', 'u-1', '2025-12-31T00:00:00.000Z', '2026-01-02T00:00:00.000Z']);
  });

  it('imports a ticket from an older file as created from the UI with no registrar', async () => {
    const qr = new FakeQueryRunner(answer);
    const data = emptyExport({
      version: '1.14.0',
      users: [{ email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' }],
      tickets: [ticket('t-1', null)],
    });

    await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    expect(qr.find(/INSERT INTO tickets/)[0].params.slice(23)).toEqual(['ui', null, null, null]);
  });

  it('rejects an unknown ticket source', async () => {
    const qr = new FakeQueryRunner(answer);
    const data = emptyExport({
      users: [{ email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' }],
      tickets: [{ ...ticket('t-1', null), source: 'fax' }],
    });
    await expect(new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data))
      .rejects.toThrow('Invalid export file: tickets[0].source must be one of: ui, email, portal, api');
  });
});

describe('ImportWorkspace edit history', () => {
  const at = '2026-01-01T00:00:00.000Z';

  it('imports edits only for tickets and comments created in this run, remapping ids, editor and mentions', async () => {
    const qr = new FakeQueryRunner((sql) => {
      if (/FROM users WHERE email = ANY/.test(sql)) return [{ id: 'u-1', email: 'alice@example.com' }];
      if (/MAX\("ticketNumber"\)/.test(sql)) return [{ max: 0 }];
      if (/SELECT id, name, "reporterId", "createdAt" FROM tickets/.test(sql)) {
        return [{ id: 'existing-t', name: 'Ticket t-old', reporterId: 'u-1', createdAt: at }];
      }
      return [];
    });
    const data = emptyExport({
      users: [{ id: 'src-alice', email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' }],
      tickets: [ticket('t-new', null), ticket('t-old', null)],
      comments: [{ id: 'c-1', content: 'now', ticketId: 't-new', authorEmail: 'alice@example.com', mentionedUserIds: [], createdAt: at }],
      descriptionEdits: [
        { ticketId: 't-new', content: 'first desc', editedByEmail: 'alice@example.com', createdAt: at },
        { ticketId: 't-old', content: 'already there', editedByEmail: 'alice@example.com', createdAt: at },
        { ticketId: 't-new', content: 'orphan', editedByEmail: null, createdAt: at },
      ],
      commentEdits: [
        { commentId: 'c-1', content: 'hi @[Alice](src-alice) @[Ghost](src-ghost)', editedByEmail: 'alice@example.com', createdAt: at },
        { commentId: 'c-unknown', content: 'x', editedByEmail: 'alice@example.com', createdAt: at },
      ],
    });

    const { result } = await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    const [ticketInsert] = qr.find(/INSERT INTO tickets/);
    const [commentInsert] = qr.find(/INSERT INTO comments/);
    const descInserts = qr.find(/INSERT INTO ticket_description_edits/);
    expect(descInserts.map((q) => q.params.slice(1))).toEqual([['first desc', ticketInsert.params[0], 'u-1', at]]);
    const commentEditInserts = qr.find(/INSERT INTO comment_edits/);
    expect(commentEditInserts.map((q) => q.params.slice(1))).toEqual([['hi @[Alice](u-1) @Ghost', commentInsert.params[0], 'u-1', at]]);
    expect(qr.queries.indexOf(commentInsert)).toBeLessThan(qr.queries.indexOf(commentEditInserts[0]));
    expect(result.descriptionEditsImported).toBe(1);
    expect(result.commentEditsImported).toBe(1);
  });

  it('rejects an edit without content', async () => {
    const qr = new FakeQueryRunner(() => []);
    const data = emptyExport({ commentEdits: [{ commentId: 'c', editedByEmail: null, createdAt: at } as never] });
    await expect(new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data))
      .rejects.toThrow('Invalid export file: commentEdits[0].content must be text');
  });
});

describe('ImportWorkspace knowledge base', () => {
  const at = '2026-01-01T00:00:00.000Z';
  const article = (id: string, slug: string, categoryId: string, content = '<p>ok</p>') => ({
    id, title: `Title ${slug}`, slug, content, status: 'published', position: 2, categoryId,
    createdByEmail: 'alice@example.com' as string | null, createdAt: at, updatedAt: at,
  });

  it('sanitizes imported ticket descriptions and comments like content created in the app', async () => {
    const qr = new FakeQueryRunner((sql) => (/FROM users WHERE email = ANY/.test(sql) ? [{ id: 'u-1', email: 'alice@example.com' }] : /MAX\("ticketNumber"\)/.test(sql) ? [{ max: 0 }] : []));
    const evil = '<p>hola</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>';
    const t1 = { ...ticket('t-1', null), description: evil };
    const data = emptyExport({
      users: [{ email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' }],
      tickets: [t1],
      comments: [{ id: 'c-1', content: evil, ticketId: 't-1', authorEmail: 'alice@example.com', mentionedUserIds: [], createdAt: '2026-01-01T00:00:00.000Z' }],
    });

    await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    const stored = [...qr.find(/INSERT INTO tickets/), ...qr.find(/INSERT INTO comments/)].map((q) => JSON.stringify(q.params));
    for (const row of stored) {
      expect(row).toContain('hola');
      expect(row).not.toContain('<script');
      expect(row).not.toContain('javascript:');
    }
  });

  it('reuses categories by slug, skips articles whose slug exists, sanitizes content and remaps audit', async () => {
    const qr = new FakeQueryRunner((sql) => {
      if (/FROM users WHERE email = ANY/.test(sql)) return [{ id: 'u-1', email: 'alice@example.com' }];
      if (/FROM kb_categories WHERE/.test(sql)) return [{ id: 'kc-existing', slug: 'start' }];
      if (/FROM kb_articles WHERE/.test(sql)) return [{ id: 'ka-existing', slug: 'hello' }];
      if (/MAX\("ticketNumber"\)/.test(sql)) return [{ max: 0 }];
      return [];
    });
    const data = emptyExport({
      users: [{ email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' }],
      kbCategories: [
        { id: 'src-start', name: 'Start', slug: 'start', icon: null, position: 0, createdAt: at },
        { id: 'src-faq', name: 'FAQ', slug: 'faq', icon: 'help', position: 1, createdAt: at },
      ],
      kbArticles: [
        article('src-hello', 'hello', 'src-start'),
        article('src-xss', 'xss', 'src-faq', '<h2>Q</h2><script>alert(1)</script><a href="javascript:alert(1)">x</a><img src="https://x/y.png" alt="y">'),
        { ...article('src-orphan', 'orphan', 'src-faq'), createdByEmail: null },
      ],
      auditLog: [
        { action: 'kb-article-created', entityType: 'kb-article', entityId: 'src-xss', userEmail: null, metadata: null, createdAt: at },
        { action: 'kb-category-created', entityType: 'kb-category', entityId: 'src-start', userEmail: null, metadata: null, createdAt: '2026-01-02T00:00:00.000Z' },
        { action: 'kb-article-updated', entityType: 'kb-article', entityId: 'src-hello', userEmail: null, metadata: null, createdAt: '2026-01-03T00:00:00.000Z' },
      ],
    });

    const { result } = await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    const categoryInserts = qr.find(/INSERT INTO kb_categories/);
    expect(categoryInserts.map((q) => q.params.slice(1, 6))).toEqual([['FAQ', 'faq', 'help', 1, 'ws-target']]);
    const articleInserts = qr.find(/INSERT INTO kb_articles/);
    expect(articleInserts).toHaveLength(1);
    const [articleId, title, slug, content, status, position, categoryId, workspaceId, createdById] = articleInserts[0].params;
    expect([title, slug, status, position, categoryId, workspaceId, createdById])
      .toEqual(['Title xss', 'xss', 'published', 2, categoryInserts[0].params[0], 'ws-target', 'u-1']);
    expect(content).toContain('<h2>Q</h2>');
    expect(content).toContain('<img src="https://x/y.png" alt="y"');
    expect(content).not.toMatch(/<script|javascript:/);
    expect(qr.find(/INSERT INTO audit_log_entries/).map((q) => q.params[3])).toEqual([articleId, 'kc-existing', 'ka-existing']);
    expect(result.kbCategoriesImported).toBe(1);
    expect(result.kbArticlesImported).toBe(1);
  });

  it('rejects an article with an unknown status', async () => {
    const qr = new FakeQueryRunner(() => []);
    const data = emptyExport({ kbArticles: [{ ...article('a', 'a', 'c'), status: 'archived' }] });
    await expect(new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data))
      .rejects.toThrow('Invalid export file: kbArticles[0].status must be one of: draft, published');
  });
});

describe('ImportWorkspace settings overwrite', () => {
  const answer: Answer = (sql) => (/MAX\("ticketNumber"\)/.test(sql) ? [{ max: 0 }] : []);
  const source = () => emptyExport({
    workspace: {
      name: 'Acme', description: 'Source description', slaPolicy: { firstResponseHours: 4 },
      metadata: { palette: 'teal', other: 'ignored' }, appName: 'Acme Desk', appSubtitle: 'Support',
    },
  });

  it('changes no workspace setting when the caller asks for none', async () => {
    const qr = new FakeQueryRunner(answer);
    const { result } = await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', source());

    expect(qr.find(/UPDATE workspaces/)).toHaveLength(0);
    expect(result.settingsApplied).toEqual([]);
  });

  it('overwrites only the requested settings, merging the palette into the existing metadata', async () => {
    const qr = new FakeQueryRunner(answer);
    const { result } = await new ImportWorkspace(dataSourceOf(qr))
      .execute('ws-target', source(), { overwrite: ['branding', 'palette'] });

    const [update] = qr.find(/UPDATE workspaces/);
    expect(update.sql).toMatch(/metadata = COALESCE\(metadata, '\{\}'::jsonb\) \|\| jsonb_build_object\('palette', \$2::text\)/);
    expect(update.sql).toMatch(/"appName" = \$3, "appSubtitle" = \$4 WHERE id = \$1/);
    expect(update.sql).not.toMatch(/slaPolicy|description|logo|icon/);
    expect(update.params).toEqual(['ws-target', 'teal', 'Acme Desk', 'Support']);
    expect(result.settingsApplied).toEqual(['palette', 'branding']);
  });

  it('leaves a setting untouched when the file has no value for it, even if asked to overwrite it', async () => {
    const qr = new FakeQueryRunner(answer);
    const empty = emptyExport({ workspace: { name: 'Acme', description: '', slaPolicy: null, metadata: null, appName: null, appSubtitle: null } });
    const { result } = await new ImportWorkspace(dataSourceOf(qr))
      .execute('ws-target', empty, { overwrite: ['palette', 'sla', 'description', 'branding'] });

    expect(qr.find(/UPDATE workspaces/)).toHaveLength(0);
    expect(result.settingsApplied).toEqual([]);
  });

  it('overwrites the SLA policy and description when asked', async () => {
    const qr = new FakeQueryRunner(answer);
    const { result } = await new ImportWorkspace(dataSourceOf(qr))
      .execute('ws-target', source(), { overwrite: ['sla', 'description'] });

    const [update] = qr.find(/UPDATE workspaces/);
    expect(update.sql).toBe('UPDATE workspaces SET "slaPolicy" = $2, description = $3 WHERE id = $1');
    expect(update.params).toEqual(['ws-target', '{"firstResponseHours":4}', 'Source description']);
    expect(result.settingsApplied).toEqual(['sla', 'description']);
  });

  it('rejects an unknown overwrite key before touching the database', async () => {
    const qr = new FakeQueryRunner(answer);
    await expect(new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', source(), { overwrite: ['palette', 'logo'] }))
      .rejects.toThrow(new DomainValidationError('Unknown overwrite setting: logo. Allowed: palette, sla, description, branding'));
    expect(qr.queries).toHaveLength(0);
  });

  it('rejects branding text longer than the column allows', async () => {
    const qr = new FakeQueryRunner(answer);
    const data = source();
    data.workspace.appSubtitle = 'x'.repeat(31);
    await expect(new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data))
      .rejects.toThrow('Invalid export file: workspace.appSubtitle must be at most 30 characters');
  });
});

const NEW_IN_1_15 = ['organizations', 'departments', 'projects', 'descriptionEdits', 'commentEdits', 'kbCategories', 'kbArticles'] as const;

describe('applyTransforms', () => {
  it('upgrades 1.12.0 to the current version by adding an empty categories list and normalising missing categories to null', () => {
    const legacy = emptyExport({ version: '1.12.0', tickets: [ticket('t-1', 'bug')] });
    delete (legacy as Partial<WorkspaceExportData>).categories;
    delete (legacy.tickets[0] as Partial<WorkspaceExportData['tickets'][number]>).category;

    const upgraded = applyTransforms(legacy);

    expect(upgraded.version).toBe(CURRENT_VERSION);
    expect(upgraded.categories).toEqual([]);
    expect(upgraded.tickets[0].category).toBeNull();
  });

  it('upgrades 1.14.0 by starting every new 1.15 section empty', () => {
    const legacy = emptyExport({ version: '1.14.0' }) as Partial<WorkspaceExportData>;
    for (const section of NEW_IN_1_15) delete legacy[section];

    const upgraded = applyTransforms(legacy as WorkspaceExportData);

    expect(upgraded.version).toBe(CURRENT_VERSION);
    for (const section of NEW_IN_1_15) expect(upgraded[section]).toEqual([]);
    expect(upgraded.workspace.appName).toBeNull();
    expect(upgraded.workspace.appSubtitle).toBeNull();
  });

  it('leaves a current-version file untouched', () => {
    const current = emptyExport({ tickets: [ticket('t-1', 'bug')] });
    const result = applyTransforms(current);
    expect(result.version).toBe(CURRENT_VERSION);
    expect(result.tickets[0].category).toBe('bug');
  });
});

describe('ImportWorkspace validation', () => {
  const alice = { email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' };

  async function importError(data: unknown): Promise<Error> {
    const qr = new FakeQueryRunner(() => []);
    const error = await new ImportWorkspace(dataSourceOf(qr))
      .execute('ws-target', data as WorkspaceExportData)
      .then(() => null, (e: Error) => e);
    expect(error).toBeInstanceOf(DomainValidationError);
    // Rejected before the transaction: nothing was read or written
    expect(qr.queries).toHaveLength(0);
    return error as Error;
  }

  it('rejects a body that is not an object', async () => {
    expect((await importError([])).message).toBe('Invalid export file: expected a JSON object');
  });

  it('rejects a file without the tickets list', async () => {
    const data = emptyExport();
    delete (data as Partial<WorkspaceExportData>).tickets;
    expect((await importError(data)).message).toBe('Invalid export file: "tickets" must be a list');
  });

  it('rejects a missing, too old or newer version with a message that says which', async () => {
    expect((await importError(emptyExport({ version: '' }))).message).toBe('Invalid export file: the "version" field is missing');
    expect((await importError(emptyExport({ version: '1.0.0' }))).message)
      .toBe(`Unsupported export version 1.0.0: this server imports versions 1.11.0 to ${CURRENT_VERSION}`);
    expect((await importError(emptyExport({ version: '9.0.0' }))).message)
      .toBe(`Export version 9.0.0 was made by a newer Open Helpdesk; this server imports up to ${CURRENT_VERSION}. Upgrade it first.`);
  });

  it('rejects a ticket without reporterEmail', async () => {
    const data = emptyExport({ users: [alice], tickets: [ticket('t-1', null), { ...ticket('t-2', null), reporterEmail: '' }] });
    expect((await importError(data)).message).toBe('Invalid export file: tickets[1].reporterEmail is required');
  });

  it('rejects an invalid date', async () => {
    const data = emptyExport({ users: [alice], tickets: [{ ...ticket('t-1', null), createdAt: 'yesterday' }] });
    expect((await importError(data)).message).toBe('Invalid export file: tickets[0].createdAt must be a valid date');
  });

  it('rejects an unknown member role', async () => {
    const data = emptyExport({ users: [{ ...alice, role: 'owner' }] });
    expect((await importError(data)).message)
      .toBe('Invalid export file: users[0].role must be one of: admin, supervisor, agent, user');
  });

  it('rejects invalid enums in tickets, custom fields and CSAT ratings', async () => {
    expect((await importError(emptyExport({ users: [alice], tickets: [{ ...ticket('t-1', null), status: 'closed' }] }))).message)
      .toMatch(/^Invalid export file: tickets\[0\]\.status must be one of: open, /);
    expect((await importError(emptyExport({
      customFields: [{ id: 'cf', name: 'X', type: 'color', options: null, position: 0, required: false, createdAt: '2026-01-01T00:00:00.000Z' }],
    }))).message).toMatch(/^Invalid export file: customFields\[0\]\.type must be one of: text, /);
    expect((await importError(emptyExport({
      csatResponses: [{ ticketId: 't-1', rating: 6, respondedAt: null, createdAt: '2026-01-01T00:00:00.000Z' }],
    }))).message).toBe('Invalid export file: csatResponses[0].rating must be a whole number from 1 to 5 or null');
  });
});

describe('buildImportPreview', () => {
  const alice = { email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' };

  it('counts what the file carries and reports the version it was exported with', () => {
    const legacy = emptyExport({
      version: '1.14.0',
      users: [alice] as WorkspaceExportData['users'],
      tickets: [ticket('t-1', null), ticket('t-2', null)],
    }) as Partial<WorkspaceExportData>;
    for (const section of NEW_IN_1_15) delete legacy[section];

    const preview = buildImportPreview(legacy as WorkspaceExportData);

    expect(preview.version).toBe('1.14.0');
    expect(preview.counts).toEqual({
      tickets: 2, comments: 0, users: 1, categories: 0, organizations: 0, departments: 0,
      projects: 0, kbArticles: 0, customFields: 0, cannedResponses: 0,
      attachments: 0, files: 0, filesBytes: 0,
    });
  });

  it('reports a setting as absent when the file has no value for it', () => {
    const preview = buildImportPreview(emptyExport({
      workspace: { name: 'Acme', description: '', slaPolicy: null, metadata: { palette: '' }, appName: null, appSubtitle: '' },
    }));
    expect(preview.settings).toEqual({ palette: null, sla: false, description: null, branding: null });
  });

  it('reports the settings the file carries', () => {
    const preview = buildImportPreview(emptyExport({
      workspace: {
        name: 'Acme', description: 'Support desk', slaPolicy: { firstResponseHours: 4 },
        metadata: { palette: 'ocean' }, appName: 'Acme Help', appSubtitle: null,
      },
    }));
    expect(preview.settings).toEqual({
      palette: 'ocean', sla: true, description: 'Support desk',
      branding: { appName: 'Acme Help', appSubtitle: null, logo: false, icon: false },
    });
  });

  it('rejects a file the import would reject', () => {
    expect(() => buildImportPreview(emptyExport({ version: '9.0.0' }))).toThrow(DomainValidationError);
    expect(() => buildImportPreview({ ...emptyExport(), tickets: 'nope' } as unknown as WorkspaceExportData))
      .toThrow(DomainValidationError);
  });
});

describe('ExportWorkspace files', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const answer: Answer = (sql) => {
    if (/FROM workspaces WHERE id/.test(sql)) {
      return [{ name: 'Acme', description: '', slaPolicy: null, metadata: null, logo: 'workspaces/ws-1/logo.png', icon: 'workspaces/ws-1/icon.svg' }];
    }
    if (/FROM organizations WHERE/.test(sql)) {
      return [
        { id: 'org-1', name: 'Globex', domains: [], logo: 'organizations/org-1/logo.webp', createdAt },
        { id: 'org-2', name: 'Initech', domains: [], logo: null, createdAt },
      ];
    }
    if (/FROM tickets t/.test(sql)) return [{ id: 't-1', name: 'T', status: 'open', reporterId: 'u-1', tagIds: [], createdAt, updatedAt: createdAt }];
    if (/FROM attachments a/.test(sql)) {
      return [
        { id: 'a-1', fileName: 'r.pdf', originalName: 'r.pdf', mimeType: 'application/pdf', size: 999, s3Key: 'attachments/a-1/r.pdf', ticketId: 't-1', commentId: null, createdAt },
        { id: 'a-2', fileName: 'gone.txt', originalName: 'gone.txt', mimeType: 'text/plain', size: 3, s3Key: 'attachments/a-2/gone.txt', ticketId: 't-1', commentId: null, createdAt },
      ];
    }
    return [];
  };

  async function prepared() {
    const storage = new FakeS3Storage();
    await storage.upload(Buffer.from('pdf-bytes'), 'attachments/a-1/r.pdf', 'application/pdf');
    await storage.upload(Buffer.from('png'), 'workspaces/ws-1/logo.png', 'image/png');
    await storage.upload(Buffer.from('<svg/>'), 'workspaces/ws-1/icon.svg', 'image/svg+xml');
    await storage.upload(Buffer.from('webp!'), 'organizations/org-1/logo.webp', 'image/webp');
    const qr = new FakeQueryRunner(answer);
    return { qr, bundle: await new ExportWorkspace(dataSourceOf(qr), storage).prepare('ws-1') };
  }

  it('refers to files by archive path, never by storage key, and lists the stored files to carry', async () => {
    const { bundle } = await prepared();
    const json = JSON.stringify(bundle.data);
    expect(json).not.toMatch(/attachments\/a-1|workspaces\/ws-1|organizations\/org-1|s3Key/);

    const [pdf] = bundle.data.attachments;
    expect(pdf.file).toMatch(/^files\/[0-9A-Z]{26}$/);
    expect(pdf).toMatchObject({ originalName: 'r.pdf', mimeType: 'application/pdf', size: 9 });
    expect(bundle.data.organizations[0].logoFile).toEqual({ file: expect.stringMatching(/^files\//), fileName: 'logo.webp', mimeType: 'image/webp', size: 5 });
    expect(bundle.data.organizations[1].logoFile).toBeNull();
    expect(bundle.data.workspace.logoFile).toMatchObject({ mimeType: 'image/png', size: 3 });
    expect(bundle.data.workspace.iconFile).toMatchObject({ mimeType: 'image/svg+xml', size: 6 });

    const byPath = new Map(bundle.files.map((f) => [f.path, f]));
    expect(byPath.get(pdf.file!)).toEqual({ path: pdf.file, storageKey: 'attachments/a-1/r.pdf', size: 9 });
    expect(byPath.get(bundle.data.workspace.logoFile!.file!)?.storageKey).toBe('workspaces/ws-1/logo.png');
    expect(bundle.files).toHaveLength(4);
    expect(new Set(bundle.files.map((f) => f.path)).size).toBe(4);
  });

  it('keeps a file missing from storage as metadata with no file and lists it, without failing', async () => {
    const { bundle } = await prepared();
    const gone = bundle.data.attachments[1];
    expect(gone).toMatchObject({ id: 'a-2', originalName: 'gone.txt', size: 3, file: null });
    expect(bundle.data.missingFiles).toEqual([{ kind: 'attachment', id: 'a-2', fileName: 'gone.txt' }]);
    expect(bundle.files.some((f) => f.storageKey === 'attachments/a-2/gone.txt')).toBe(false);
  });

  it('leaves staged uploads that no ticket claimed out of the export', async () => {
    const { qr } = await prepared();
    expect(qr.find(/FROM attachments a/)[0].sql).toMatch(/a\."stagedAt" IS NULL/);
  });
});

describe('ImportWorkspace files', () => {
  const at = '2026-01-01T00:00:00.000Z';
  const answer: Answer = (sql) => {
    if (/FROM users WHERE email = ANY/.test(sql)) return [{ id: 'u-1', email: 'alice@example.com' }];
    if (/SELECT logo, icon FROM workspaces/.test(sql)) return [{ logo: 'workspaces/ws-target/logo.png', icon: null }];
    if (/MAX\("ticketNumber"\)/.test(sql)) return [{ max: 0 }];
    return [];
  };
  const attachment = (id: string, extra: Record<string, unknown>) => ({
    id, fileName: `${id}.pdf`, originalName: `${id}.pdf`, mimeType: 'application/pdf', size: 1,
    ticketId: 'src-t', commentId: null, uploadedByEmail: null, createdAt: at, ...extra,
  });
  const withAttachments = (attachments: unknown[], extra: Partial<WorkspaceExportData> = {}) => emptyExport({
    users: [{ email: 'alice@example.com', firstName: 'A', lastName: 'A', role: 'admin' }],
    tickets: [ticket('src-t', null)],
    attachments: attachments as WorkspaceExportData['attachments'],
    ...extra,
  });

  it('stores carried bytes under a fresh key for the target and never reuses a key from the file', async () => {
    const qr = new FakeQueryRunner(answer);
    const storage = new FakeS3Storage();
    const data = withAttachments([attachment('src-a', { file: 'files/one', s3Key: 'attachments/victim/secret.pdf', size: 1 })]);

    const { result } = await new ImportWorkspace(dataSourceOf(qr), storage)
      .execute('ws-target', data, { files: archiveOf({ 'files/one': Buffer.from('bytes!') }) });

    const [insert] = qr.find(/INSERT INTO attachments/);
    const [newId, , originalName, , size, key] = insert.params as string[];
    expect(newId).not.toBe('src-a');
    expect(key).toBe(`attachments/${newId}/${originalName}`);
    expect(key).not.toMatch(/victim/);
    expect(size).toBe(6);
    expect(storage.read(key)?.toString()).toBe('bytes!');
    expect(storage.uploadedKeys).toEqual([key]);
    expect(result).toMatchObject({ attachmentsImported: 1, attachmentsSkipped: 0 });
  });

  it('skips and counts attachments the file carries no bytes for', async () => {
    const qr = new FakeQueryRunner(answer);
    const storage = new FakeS3Storage();
    const data = withAttachments([
      attachment('no-file', { file: null }),
      attachment('not-in-archive', { file: 'files/absent' }),
      attachment('carried', { file: 'files/one' }),
    ]);

    const { result } = await new ImportWorkspace(dataSourceOf(qr), storage)
      .execute('ws-target', data, { files: archiveOf({ 'files/one': Buffer.from('x') }) });

    expect(result).toMatchObject({ attachmentsImported: 1, attachmentsSkipped: 2 });
    expect(qr.find(/INSERT INTO attachments/)).toHaveLength(1);
  });

  it('skips the attachments of a 1.15 file, whose rows only name a source storage key', async () => {
    const qr = new FakeQueryRunner(answer);
    const storage = new FakeS3Storage();
    const data = withAttachments([attachment('old', { s3Key: 'attachments/other-ws/file.pdf' })], { version: '1.15.0' });

    const { result } = await new ImportWorkspace(dataSourceOf(qr), storage).execute('ws-target', data);

    expect(result).toMatchObject({ attachmentsImported: 0, attachmentsSkipped: 1 });
    expect(qr.find(/INSERT INTO attachments/)).toHaveLength(0);
    expect(storage.uploadedKeys).toEqual([]);
  });

  it('imports no file at all without storage', async () => {
    const qr = new FakeQueryRunner(answer);
    const { result } = await new ImportWorkspace(dataSourceOf(qr))
      .execute('ws-target', withAttachments([attachment('a', { file: 'files/one' })]), { files: archiveOf({ 'files/one': Buffer.from('x') }) });
    expect(result).toMatchObject({ attachmentsImported: 0, attachmentsSkipped: 1 });
  });

  it('deletes what it stored when the transaction rolls back, reporting deletes that fail', async () => {
    const qr = new FakeQueryRunner((sql, params) => {
      if (/INSERT INTO audit_log_entries/.test(sql)) throw new Error('database went away');
      return answer(sql, params);
    });
    const storage = new FakeS3Storage();
    const failures: string[] = [];
    const data = withAttachments(
      [attachment('a', { file: 'files/one' }), attachment('b', { file: 'files/two' })],
      { auditLog: [{ action: 'x', entityType: 'ticket', entityId: 'src-t', userEmail: null, metadata: null, createdAt: at }] },
    );
    const files = archiveOf({ 'files/one': Buffer.from('1'), 'files/two': Buffer.from('2') });
    const service = new ImportWorkspace(dataSourceOf(qr), storage, (key) => failures.push(key));
    const original = storage.putStream.bind(storage);
    storage.putStream = async (key, stream, mime, size) => {
      await original(key, stream, mime, size);
      if (storage.uploadedKeys.length === 2) storage.failingDeletes.add(key);
    };

    await expect(service.execute('ws-target', data, { files })).rejects.toThrow('database went away');

    expect(qr.rolledBack).toBe(true);
    expect(qr.committed).toBe(false);
    expect(storage.uploadedKeys).toHaveLength(2);
    expect(storage.deletedKeys).toEqual(storage.uploadedKeys);
    expect(storage.hasFile(storage.uploadedKeys[0])).toBe(false);
    expect(failures).toEqual([storage.uploadedKeys[1]]);
  });

  it('gives a new organization the carried logo under the organization logo key', async () => {
    const qr = new FakeQueryRunner(answer);
    const storage = new FakeS3Storage();
    const data = withAttachments([], {
      organizations: [
        { id: 'src-org', name: 'Globex', description: null, notes: null, domains: [], createdAt: at, logoFile: { file: 'files/logo', fileName: 'logo.png', mimeType: 'image/png', size: 3 } },
        { id: 'src-org-2', name: 'Initech', description: null, notes: null, domains: [], createdAt: at, logoFile: { file: null, fileName: 'logo.png', mimeType: 'image/png', size: null } },
        { id: 'src-org-3', name: 'Hooli', description: null, notes: null, domains: [], createdAt: at, logoFile: { file: 'files/exe', fileName: 'x.exe', mimeType: 'application/x-msdownload', size: 3 } },
      ],
    });

    await new ImportWorkspace(dataSourceOf(qr), storage)
      .execute('ws-target', data, { files: archiveOf({ 'files/logo': Buffer.from('png'), 'files/exe': Buffer.from('MZ!') }) });

    const orgIds = qr.find(/INSERT INTO organizations/).map((q) => q.params[0]);
    const updates = qr.find(/UPDATE organizations SET logo/);
    expect(updates.map((q) => q.params)).toEqual([[orgIds[0], `organizations/${orgIds[0]}/logo.png`]]);
    expect(storage.read(`organizations/${orgIds[0]}/logo.png`)?.toString()).toBe('png');
    expect(storage.uploadedKeys).toHaveLength(1);
  });

  it('applies the workspace logo and icon only when branding is overwritten, under keys of their own', async () => {
    const logoFile = { file: 'files/logo', fileName: 'logo.svg', mimeType: 'image/svg+xml', size: 6 };
    const iconFile = { file: 'files/icon', fileName: 'icon.png', mimeType: 'image/png', size: 3 };
    const files = archiveOf({ 'files/logo': Buffer.from('<svg/>'), 'files/icon': Buffer.from('png') });
    const data = () => withAttachments([], { workspace: { name: 'Acme', description: '', slaPolicy: null, metadata: null, logoFile, iconFile } });

    const untouched = new FakeS3Storage();
    const qr1 = new FakeQueryRunner(answer);
    await new ImportWorkspace(dataSourceOf(qr1), untouched).execute('ws-target', data(), { files });
    expect(untouched.uploadedKeys).toEqual([]);
    expect(qr1.find(/UPDATE workspaces/)).toHaveLength(0);

    const storage = new FakeS3Storage();
    await storage.upload(Buffer.from('old'), 'workspaces/ws-target/logo.png', 'image/png');
    const qr = new FakeQueryRunner(answer);
    const { result } = await new ImportWorkspace(dataSourceOf(qr), storage).execute('ws-target', data(), { files, overwrite: ['branding'] });

    const [update] = qr.find(/UPDATE workspaces SET/);
    expect(update.sql).toMatch(/logo = \$2, icon = \$3/);
    expect(update.sql).not.toMatch(/appName/);
    const [, logoKey, iconKey] = update.params as string[];
    expect(logoKey).toMatch(/^workspaces\/ws-target\/logo-[0-9A-Z]{26}\.svg$/);
    expect(iconKey).toMatch(/^workspaces\/ws-target\/icon-[0-9A-Z]{26}\.png$/);
    expect(storage.read(logoKey)?.toString()).toBe('<svg/>');
    expect(result.settingsApplied).toEqual(['branding']);
    // The logo it replaced is deleted once the import committed
    expect(storage.hasFile('workspaces/ws-target/logo.png')).toBe(false);
  });

  it('leaves a workspace icon over the icon size limit unset', async () => {
    const big = Buffer.alloc(512 * 1024 + 1);
    const data = withAttachments([], {
      workspace: { name: 'Acme', description: '', slaPolicy: null, metadata: null, iconFile: { file: 'files/icon', fileName: 'i.png', mimeType: 'image/png', size: big.length } },
    });
    const storage = new FakeS3Storage();
    const qr = new FakeQueryRunner(answer);
    const { result } = await new ImportWorkspace(dataSourceOf(qr), storage)
      .execute('ws-target', data, { files: archiveOf({ 'files/icon': big }), overwrite: ['branding'] });
    expect(storage.uploadedKeys).toEqual([]);
    expect(result.settingsApplied).toEqual([]);
  });
});

describe('applyTransforms 1.17', () => {
  it('upgrades 1.16.0: every entity with an id takes it as its origin id, edits without one get none', () => {
    const legacy = emptyExport({
      version: '1.16.0',
      tickets: [ticket('t-1', null)],
      tags: [{ id: 'tag-1', name: 'x', color: null, createdAt: '2026-01-01T00:00:00.000Z' }],
      descriptionEdits: [{ ticketId: 't-1', content: 'c', editedByEmail: null, createdAt: '2026-01-01T00:00:00.000Z' }],
    });
    const upgraded = applyTransforms(legacy);
    expect(upgraded.version).toBe('1.17.0');
    expect(upgraded.tickets[0].originId).toBe('t-1');
    expect(upgraded.tags[0].originId).toBe('tag-1');
    expect(upgraded.descriptionEdits[0]).not.toHaveProperty('originId');
  });

  it('keeps the origin id a 1.17 file carries', () => {
    const data = emptyExport({ tickets: [{ ...ticket('t-1', null), originId: 'elsewhere' }] });
    expect(applyTransforms(data).tickets[0].originId).toBe('elsewhere');
  });
});

describe('applyTransforms 1.16', () => {
  it('upgrades 1.15.0: attachments lose the source key and carry no file, logos are absent', () => {
    const legacy = emptyExport({
      version: '1.15.0',
      organizations: [{ id: 'o', name: 'O', description: null, notes: null, domains: [], createdAt: '2026-01-01T00:00:00.000Z' }],
      attachments: [{ id: 'a', fileName: 'f', originalName: 'f', mimeType: 'text/plain', size: 1, s3Key: 'attachments/a/f', ticketId: 't', commentId: null, uploadedByEmail: null, createdAt: '2026-01-01T00:00:00.000Z' }],
    });
    const upgraded = applyTransforms(legacy);
    expect(upgraded.version).toBe(CURRENT_VERSION);
    expect(upgraded.attachments[0].file).toBeNull();
    expect(upgraded.attachments[0]).not.toHaveProperty('s3Key');
    expect(upgraded.organizations[0].logoFile).toBeNull();
    expect(upgraded.workspace.logoFile).toBeNull();
    expect(upgraded.workspace.iconFile).toBeNull();
    expect(upgraded.missingFiles).toEqual([]);
  });

  it('previews the attachments carried and the archive files', () => {
    const preview = buildImportPreview(emptyExport({
      attachments: [
        { id: 'a', fileName: 'f', originalName: 'f', mimeType: 'text/plain', size: 1, file: 'files/a', ticketId: 't', commentId: null, uploadedByEmail: null, createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'b', fileName: 'f', originalName: 'f', mimeType: 'text/plain', size: 1, file: null, ticketId: 't', commentId: null, uploadedByEmail: null, createdAt: '2026-01-01T00:00:00.000Z' },
      ],
      workspace: { name: 'A', description: '', slaPolicy: null, metadata: null, logoFile: { file: 'files/l', fileName: 'l.png', mimeType: 'image/png', size: 1 } },
    }), { files: 2, bytes: 1234 });
    expect(preview.counts).toMatchObject({ attachments: 1, files: 2, filesBytes: 1234 });
    expect(preview.settings.branding).toEqual({ appName: null, appSubtitle: null, logo: true, icon: false });
  });
});

describe('ImportWorkspace files are stored before the transaction', () => {
  const at = '2026-01-01T00:00:00.000Z';
  const base: Answer = (sql) => {
    if (/FROM users WHERE email = ANY/.test(sql)) return [{ id: 'u-1', email: 'alice@example.com' }];
    if (/MAX\("ticketNumber"\)/.test(sql)) return [{ max: 0 }];
    return [];
  };
  const data = (extra: Partial<WorkspaceExportData> = {}) => emptyExport({
    users: [{ email: 'alice@example.com', firstName: 'A', lastName: 'A', role: 'admin' }],
    tickets: [ticket('src-t', null)],
    attachments: [{ id: 'a', fileName: 'a.pdf', originalName: 'a.pdf', mimeType: 'application/pdf', size: 1, file: 'files/a', ticketId: 'src-t', commentId: null, uploadedByEmail: null, createdAt: at }],
    ...extra,
  });
  const files = archiveOf({ 'files/a': Buffer.from('aaa'), 'files/logo': Buffer.from('png') });

  class RecordingQueryRunner extends FakeQueryRunner {
    constructor(answer: Answer, private readonly events: string[]) { super(answer); }
    async startTransaction() { this.events.push('begin'); }
  }

  it('uploads every file before the transaction, and so before the ticket number lock', async () => {
    const events: string[] = [];
    const qr = new RecordingQueryRunner((sql, params) => {
      if (/pg_advisory_xact_lock/.test(sql)) events.push('lock');
      if (/INSERT INTO attachments/.test(sql)) events.push('insert');
      return base(sql, params);
    }, events);
    const storage = new FakeS3Storage();
    const put = storage.putStream.bind(storage);
    storage.putStream = async (...args) => { events.push('put'); await put(...args); };

    const { result } = await new ImportWorkspace(dataSourceOf(qr), storage).execute('ws-target', data(), { files });

    expect(events).toEqual(['put', 'begin', 'lock', 'insert']);
    const [insert] = qr.find(/INSERT INTO attachments/);
    expect(storage.read(insert.params[5] as string)?.toString()).toBe('aaa');
    expect(result.attachmentsImported).toBe(1);
  });

  it('uploads nothing for an attachment whose ticket is already imported, or an organization that has a logo', async () => {
    const qr = new FakeQueryRunner((sql, params) => {
      if (/FROM tickets WHERE "workspaceId"/.test(sql)) return [{ id: 't-existing', name: 'Ticket src-t', reporterId: 'u-1', createdAt: at }];
      if (/FROM organizations WHERE "workspaceId"/.test(sql)) return [{ id: 'org-here', name: 'Globex', logo: 'organizations/org-here/logo.png' }];
      return base(sql, params);
    });
    const storage = new FakeS3Storage();
    const { result } = await new ImportWorkspace(dataSourceOf(qr), storage).execute('ws-target', data({
      organizations: [{ id: 'src-org', name: 'Globex', description: null, notes: null, domains: [], createdAt: at, logoFile: { file: 'files/logo', fileName: 'logo.png', mimeType: 'image/png', size: 3 } }],
    }), { files });

    expect(storage.uploadedKeys).toEqual([]);
    expect(result).toMatchObject({ ticketsImported: 0, attachmentsImported: 0, ticketsAlreadyPresent: 1, attachmentsOfExistingTickets: 1, attachmentsSkipped: 0 });
    expect(qr.find(/UPDATE organizations SET logo/)).toHaveLength(0);
  });

  it('creates a new organization with the id its logo key was stored under', async () => {
    const qr = new FakeQueryRunner(base);
    const storage = new FakeS3Storage();
    await new ImportWorkspace(dataSourceOf(qr), storage).execute('ws-target', data({
      organizations: [{ id: 'src-org', name: 'Globex', description: null, notes: null, domains: [], createdAt: at, logoFile: { file: 'files/logo', fileName: 'logo.png', mimeType: 'image/png', size: 3 } }],
    }), { files });

    const orgId = qr.find(/INSERT INTO organizations/)[0].params[0];
    expect(qr.find(/UPDATE organizations SET logo/)[0].params).toEqual([orgId, `organizations/${orgId}/logo.png`]);
    expect(storage.hasFile(`organizations/${orgId}/logo.png`)).toBe(true);
  });

  it('deletes after commit an object stored for a row the transaction ended up not inserting', async () => {
    let ticketReads = 0;
    const qr = new FakeQueryRunner((sql, params) => {
      // Empty when the files are planned, then the ticket appears before the transaction reads it
      if (/FROM tickets WHERE "workspaceId"/.test(sql) && ticketReads++ > 0) {
        return [{ id: 't-existing', name: 'Ticket src-t', reporterId: 'u-1', createdAt: at }];
      }
      return base(sql, params);
    });
    const storage = new FakeS3Storage();
    const { result } = await new ImportWorkspace(dataSourceOf(qr), storage).execute('ws-target', data(), { files });

    expect(qr.committed).toBe(true);
    expect(result.attachmentsImported).toBe(0);
    expect(storage.uploadedKeys).toHaveLength(1);
    expect(storage.deletedKeys).toEqual(storage.uploadedKeys);
    expect(storage.keys()).toEqual([]);
  });

  it('deletes what it stored and never opens the transaction when an upload fails', async () => {
    const events: string[] = [];
    const qr = new RecordingQueryRunner(base, events);
    const storage = new FakeS3Storage();
    const two = archiveOf({ 'files/a': Buffer.from('a'), 'files/b': Buffer.from('b') });
    const put = storage.putStream.bind(storage);
    storage.putStream = async (key, stream, mime, size) => {
      if (storage.uploadedKeys.length === 1) throw new Error('storage is down');
      await put(key, stream, mime, size);
    };
    const twoAttachments = data();
    twoAttachments.attachments.push({ ...twoAttachments.attachments[0], id: 'b', file: 'files/b' });

    await expect(new ImportWorkspace(dataSourceOf(qr), storage).execute('ws-target', twoAttachments, { files: two }))
      .rejects.toThrow('storage is down');

    expect(events).toEqual([]);
    expect(storage.keys()).toEqual([]);
    expect(storage.deletedKeys).toHaveLength(2);
  });
});
