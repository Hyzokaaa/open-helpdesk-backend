import { DataSource } from 'typeorm';
import { ExportWorkspace } from '../../../../src/workspace/domain/services/workspace-export';
import { ImportWorkspace } from '../../../../src/workspace/domain/services/workspace-import';
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
    attachments: [],
    participants: [],
    cannedResponses: [],
    customFields: [],
    csatResponses: [],
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
      { id: 'cat-1', name: 'Bug', slug: 'bug', color: 'red', createdAt: '2026-01-01T00:00:00.000Z' },
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

    expect(qr.find(/FROM workspaces WHERE id/)[0].sql).not.toMatch(/logo|icon/);
    expect(result.workspace).toEqual({
      name: 'Acme', description: 'd', slaPolicy: null, metadata: { palette: 'teal' }, appName: 'Acme Desk', appSubtitle: 'Support',
    });
  });

  it('exports live organizations without the logo, and the organization of members and tickets', async () => {
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
    expect(orgQuery.sql).not.toMatch(/logo/);
    expect(result.organizations).toEqual([
      { id: 'org-1', name: 'Globex', description: null, notes: 'vip', domains: ['globex.com'], createdAt: '2026-01-01T00:00:00.000Z' },
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
      { id: 'd-1', name: 'Billing', description: 'money', memberEmails: ['a@example.com'], createdAt: '2026-01-01T00:00:00.000Z' },
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
      { id: 'p-1', name: 'Website', description: null, categorySlugs: ['bug'], createdAt: '2026-01-01T00:00:00.000Z' },
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
      attachments: [{ id: 'src-a', fileName: 'f', originalName: 'f', mimeType: 'text/plain', size: 1, s3Key: 'k', ticketId: 'src-t', commentId: null, uploadedByEmail: null, createdAt: at(0) }],
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

    await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

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

const NEW_IN_1_15 = ['organizations', 'departments', 'projects'] as const;

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

    expect(upgraded.version).toBe('1.15.0');
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
