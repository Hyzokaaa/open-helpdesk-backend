import { DataSource } from 'typeorm';
import { Readable } from 'stream';
import { ExportWorkspace } from '../../../../src/workspace/domain/services/workspace-export';
import { buildImportPreview, ImportArchiveFiles, ImportWorkspace, withCustomDomainConflict } from '../../../../src/workspace/domain/services/workspace-import';
import { FakeS3Storage } from '../../../mocks/fake-s3-storage';
import { applyTransforms, CURRENT_VERSION } from '../../../../src/workspace/domain/services/workspace-export-transforms';
import { WorkspaceExportData } from '../../../../src/workspace/domain/workspace-export';
import { DomainValidationError } from '../../../../src/shared/domain/errors';
import { createExportToken, validateExportToken } from '../../../../src/workspace/domain/services/workspace-export-token';

/** An imported audit row's metadata without the import mark, to compare what the file carried. */
function withoutImportMark(param: unknown): Record<string, unknown> {
  const { imported: _imported, ...rest } = JSON.parse(param as string);
  return rest;
}

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
    mailboxes: [],
    emailRules: [],
    emailSender: null,
    webhooks: [],
    customDomain: null,
    analytics: null,
    ticketReference: null,
    credentialsIncluded: false,
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
    reference: `REF-${id}`.toUpperCase(),
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

  it('exports the ticket source, registrar, origin date, description edit date and mailbox origin id', async () => {
    const origin = new Date('2025-12-31T00:00:00.000Z');
    const qr = new FakeQueryRunner((sql, params) => {
      if (/FROM tickets t/.test(sql)) {
        return [{
          id: 't-1', name: 'T', status: 'open', category: null, reporterId: 'u-1', tagIds: [], createdAt, updatedAt: createdAt,
          source: 'email', registeredById: 'u-agent', originDate: origin, descriptionEditedAt: createdAt, mailboxId: 'mb-1',
        }];
      }
      if (/FROM users WHERE id = ANY/.test(sql)) return [{ id: 'u-agent', email: 'agent@example.com', firstName: 'Ag', lastName: 'E' }];
      if (/FROM workspace_import_links/.test(sql)) return [{ entityType: 'mailbox', sourceId: 'mb-origin', targetId: 'mb-1' }];
      return answer(sql, params);
    });
    const result = await new ExportWorkspace(dataSourceOf(qr)).execute('ws-1');

    expect(qr.find(/FROM tickets t/)[0].sql).toMatch(/t."mailboxId"/);
    expect(result.tickets[0]).toMatchObject({
      source: 'email', registeredByEmail: 'agent@example.com',
      originDate: '2025-12-31T00:00:00.000Z', descriptionEditedAt: '2026-01-01T00:00:00.000Z',
      mailboxOriginId: 'mb-origin',
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

describe('ExportWorkspace configuration', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const configured: Answer = (sql) => {
    if (/FROM workspaces WHERE id/.test(sql)) {
      return [{ name: 'Acme', description: 'd', slaPolicy: null, metadata: null, customDomain: 'help.acme.com' }];
    }
    if (/FROM mailboxes WHERE/.test(sql)) {
      return [{
        id: 'mb-1', address: 'support@acme.com', type: 'imap', imapHost: 'imap.acme.com', imapPort: 993, imapUser: 'support',
        imapPass: 'imap-secret', encryption: 'tls', imapFolder: 'INBOX', pollInterval: 30, addressMode: 'all',
        acceptedAddresses: ['help@acme.com'], autoReply: true, postProcessAction: 'none', postProcessFolder: null,
      }];
    }
    if (/FROM email_rules WHERE/.test(sql)) {
      return [{
        id: 'r-1', name: 'Spam', position: 0, isActive: true, mailboxIds: ['mb-1'],
        conditions: [{ field: 'from', operator: 'contains', value: 'spam' }], actions: [{ type: 'reject' }],
      }];
    }
    if (/FROM workspace_email_senders WHERE/.test(sql)) {
      return [{ smtpHost: 'smtp.acme.com', smtpPort: 587, smtpUser: 'mailer', smtpPass: 'smtp-secret', smtpFrom: 'no-reply@acme.com', encryption: 'tls', fromName: 'Acme', fromEmail: null }];
    }
    if (/FROM webhooks WHERE/.test(sql)) {
      return [{ id: 'wh-1', url: 'https://hooks.acme.com/x', events: 'ticket.created,comment.created', secret: 'hook-secret', createdAt }];
    }
    return [];
  };

  it('exports mailboxes, email rules, the sender, webhooks and the custom domain without any secret by default', async () => {
    const qr = new FakeQueryRunner(configured);
    const result = await new ExportWorkspace(dataSourceOf(qr)).execute('ws-1');

    for (const pattern of [/FROM mailboxes WHERE/, /FROM workspace_email_senders WHERE/, /FROM webhooks WHERE/]) {
      const [query] = qr.find(pattern);
      expect(query.sql).toMatch(/"workspaceId" = \$1/);
      expect(query.params).toEqual(['ws-1']);
      expect(query.sql).not.toMatch(/imapPass|smtpPass|secret/);
    }
    expect(result.credentialsIncluded).toBe(false);
    expect(result.customDomain).toBe('help.acme.com');
    expect(result.mailboxes).toEqual([{
      id: 'mb-1', originId: 'mb-1', address: 'support@acme.com', type: 'imap', imapHost: 'imap.acme.com', imapPort: 993,
      imapUser: 'support', encryption: 'tls', imapFolder: 'INBOX', pollInterval: 30, addressMode: 'all',
      acceptedAddresses: ['help@acme.com'], autoReply: true, postProcessAction: 'none', postProcessFolder: null,
    }]);
    expect(result.emailRules).toEqual([{
      id: 'r-1', originId: 'r-1', name: 'Spam', position: 0, isActive: true,
      conditions: [{ field: 'from', operator: 'contains', value: 'spam' }], actions: [{ type: 'reject' }], mailboxOriginIds: ['mb-1'],
    }]);
    expect(result.emailSender).toEqual({
      smtpHost: 'smtp.acme.com', smtpPort: 587, smtpUser: 'mailer', smtpFrom: 'no-reply@acme.com', encryption: 'tls', fromName: 'Acme', fromEmail: null,
    });
    expect(result.webhooks).toEqual([{ id: 'wh-1', originId: 'wh-1', url: 'https://hooks.acme.com/x', events: ['ticket.created', 'comment.created'] }]);
    expect(JSON.stringify(result)).not.toMatch(/imap-secret|smtp-secret|hook-secret/);
  });

  it('carries the passwords and secrets only when asked to include credentials', async () => {
    const qr = new FakeQueryRunner(configured);
    const result = await new ExportWorkspace(dataSourceOf(qr)).execute('ws-1', { includeCredentials: true });

    expect(result.credentialsIncluded).toBe(true);
    expect(result.mailboxes[0].imapPass).toBe('imap-secret');
    expect(result.emailSender?.smtpPass).toBe('smtp-secret');
    expect(result.webhooks[0].secret).toBe('hook-secret');
  });

  it('remaps rule mailboxes to their origin ids and exports a null sender when the workspace has none', async () => {
    const qr = new FakeQueryRunner((sql, params) => {
      if (/FROM workspace_import_links/.test(sql)) return [{ entityType: 'mailbox', sourceId: 'mb-origin', targetId: 'mb-1' }];
      if (/FROM workspace_email_senders WHERE/.test(sql)) return [];
      return configured(sql, params);
    });
    const result = await new ExportWorkspace(dataSourceOf(qr)).execute('ws-1');

    expect(result.mailboxes[0].originId).toBe('mb-origin');
    expect(result.emailRules[0].mailboxOriginIds).toEqual(['mb-origin']);
    expect(result.emailSender).toBeNull();
  });

  it('never exports API keys, even with credentials', async () => {
    const qr = new FakeQueryRunner(configured);
    const result = await new ExportWorkspace(dataSourceOf(qr)).execute('ws-1', { includeCredentials: true });

    expect(qr.find(/api_keys/)).toHaveLength(0);
    expect(Object.keys(result).filter((key) => /api/i.test(key))).toEqual([]);
  });
});

describe('export tokens', () => {
  const key = { key: Buffer.alloc(32), salt: Buffer.alloc(16), iterations: 1 };

  it('remember whether their download includes credentials, off by default', () => {
    const withCredentials = createExportToken('ws-1', key, true);
    const without = createExportToken('ws-1', key);

    expect(validateExportToken(withCredentials.token)?.includeCredentials).toBe(true);
    const entry = validateExportToken(without.token);
    expect(entry?.includeCredentials).toBe(false);
    // The expiry the link was created with, for the audit entry of its download
    expect(entry?.expiresAt.getTime()).toBe(without.expiresAt.getTime());
    // Single use
    expect(validateExportToken(withCredentials.token)).toBeNull();
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

  it('carries the audit category and level, marks every row as imported and keeps the source it claimed', async () => {
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
    expect(inserts.map((q) => q.params.slice(7, 10))).toEqual([['email', 'error', 'import'], ['ticket', 'info', 'import']]);
    const imported = inserts.map((q) => JSON.parse(q.params[6] as string).imported);
    expect(imported.map((i) => i.originalSource)).toEqual(['system', null]);
    expect(imported.every((i) => typeof i.at === 'string')).toBe(true);
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
    expect(withoutImportMark(audit[0].params[6])).toEqual({
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
    expect(withoutImportMark(audit.params[6])).toEqual({ organizationId: 'org-existing' });
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
    expect(withoutImportMark(audit.params[6])).toEqual({ departmentId: 'dept-existing' });
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
    expect(withoutImportMark(audit.params[6])).toEqual({ projectId: 'proj-existing' });
    expect(result.projectsImported).toBe(1);
  });
});

describe('ImportWorkspace ticket fields', () => {
  const answer: Answer = (sql) => {
    if (/FROM users WHERE email = ANY/.test(sql)) return [{ id: 'u-1', email: 'alice@example.com' }];
    if (/MAX\("ticketNumber"\)/.test(sql)) return [{ max: 0 }];
    return [];
  };

  it('carries source, registrar, origin date and description edit date, leaving the mailbox empty without one in the file', async () => {
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
    expect(insert.params.slice(23, 28)).toEqual(['portal', 'u-1', '2025-12-31T00:00:00.000Z', '2026-01-02T00:00:00.000Z', null]);
  });

  it('imports a ticket from an older file as created from the UI with no registrar', async () => {
    const qr = new FakeQueryRunner(answer);
    const data = emptyExport({
      version: '1.14.0',
      users: [{ email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' }],
      tickets: [ticket('t-1', null)],
    });

    await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    expect(qr.find(/INSERT INTO tickets/)[0].params.slice(23, 28)).toEqual(['ui', null, null, null, null]);
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
      .rejects.toThrow(new DomainValidationError('Unknown overwrite setting: logo. Allowed: palette, sla, description, branding, name, emailSender, customDomain, analytics, ticketReference'));
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
      attachments: 0, files: 0, filesBytes: 0, mailboxes: 0, emailRules: 0, webhooks: 0,
    });
    expect(preview.credentialsIncluded).toBe(false);
  });

  it('reports a setting as absent when the file has no value for it', () => {
    const preview = buildImportPreview(emptyExport({
      workspace: { name: 'Acme', description: '', slaPolicy: null, metadata: { palette: '' }, appName: null, appSubtitle: '' },
    }));
    expect(preview.settings).toEqual({ palette: null, sla: false, description: null, branding: null, name: 'Acme', emailSender: null, customDomain: null, customDomainConflict: false, analytics: null, ticketReference: null });
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
      name: 'Acme', emailSender: null, customDomain: null, customDomainConflict: false, analytics: null, ticketReference: null,
    });
  });

  it('reports the configuration the file carries and whether it includes credentials', () => {
    const sender = { smtpHost: 'smtp.acme.com', smtpPort: 587, smtpUser: 'mailer', smtpFrom: 'no-reply@acme.com', encryption: 'tls', fromName: null, fromEmail: null };
    const mailbox = {
      originId: 'mb', address: 'a@acme.com', type: 'imap', imapHost: null, imapPort: null, imapUser: null, encryption: 'tls',
      imapFolder: null, pollInterval: null, addressMode: 'all', acceptedAddresses: [], autoReply: true, postProcessAction: 'none', postProcessFolder: null,
    };
    const preview = buildImportPreview(emptyExport({
      credentialsIncluded: true,
      customDomain: 'help.acme.com',
      emailSender: { ...sender, fromEmail: 'help@acme.com', smtpPass: 'p' },
      mailboxes: [mailbox],
      emailRules: [{ originId: 'r', name: 'R', position: 0, isActive: true, conditions: [], actions: [], mailboxOriginIds: [] }],
      webhooks: [{ originId: 'w1', url: 'https://a.example', events: [] }, { originId: 'w2', url: 'https://b.example', events: [] }],
    }));
    expect(preview.counts).toMatchObject({ mailboxes: 1, emailRules: 1, webhooks: 2 });
    expect(preview.settings).toMatchObject({ customDomain: 'help.acme.com', emailSender: { fromAddress: 'help@acme.com', hasCredentials: true } });
    expect(preview.credentialsIncluded).toBe(true);

    const withoutPassword = buildImportPreview(emptyExport({ emailSender: sender }));
    expect(withoutPassword.settings.emailSender).toEqual({ fromAddress: 'no-reply@acme.com', hasCredentials: false });
  });

  it('reports a custom domain another workspace here already uses, checked as the import checks it', async () => {
    const preview = buildImportPreview(emptyExport({ customDomain: 'Help.Acme.com' }));
    const taken = new FakeQueryRunner((sql) => (/FROM workspaces w WHERE lower\(w\."customDomain"\)/.test(sql) ? [{ id: 'ws-other', name: 'Other', isMember: false }] : []));

    const conflicted = await withCustomDomainConflict(taken, preview, 'ws-target');
    expect(conflicted.settings.customDomainConflict).toBe(true);
    const [check] = taken.queries;
    expect(check.params.slice(0, 2)).toEqual(['help.acme.com', 'ws-target']);

    const free = await withCustomDomainConflict(new FakeQueryRunner(() => []), preview, 'ws-target');
    expect(free.settings.customDomainConflict).toBe(false);

    // No domain in the file: nothing to check
    const none = new FakeQueryRunner(() => [{ id: 'x', name: 'X', isMember: false }]);
    expect((await withCustomDomainConflict(none, buildImportPreview(emptyExport()), 'ws-target')).settings.customDomainConflict).toBe(false);
    expect(none.queries).toHaveLength(0);
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
    expect(upgraded.version).toBe(CURRENT_VERSION);
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

/** The [entityType, sourceId, targetId] of every link the import wrote, in order. */
function linksWritten(qr: FakeQueryRunner): [string, string, string][] {
  const rows: [string, string, string][] = [];
  for (const q of qr.find(/INSERT INTO workspace_import_links/)) {
    for (let i = 0; i < q.params.length; i += 5) rows.push([q.params[i + 2], q.params[i + 3], q.params[i + 4]] as [string, string, string]);
  }
  return rows;
}

type TableRows = Record<string, unknown[]>;

/** Answers the reads of an import from in-memory rows, by table. */
function answerFrom(rows: TableRows): Answer {
  return (sql) => {
    if (/FROM users WHERE email = ANY/.test(sql)) return [{ id: 'u-1', email: 'alice@example.com' }];
    if (/MAX\("ticketNumber"\)/.test(sql)) return [{ max: 0 }];
    if (/FROM workspace_import_links/.test(sql)) return rows.links ?? [];
    if (/FROM tickets WHERE "workspaceId"/.test(sql)) return rows.tickets ?? [];
    if (/FROM tickets WHERE id = ANY/.test(sql)) return rows.ticketDetails ?? [];
    if (/FROM ticket_tag WHERE/.test(sql)) return rows.ticketTags ?? [];
    if (/FROM comments WHERE/.test(sql)) return rows.comments ?? [];
    if (/FROM attachments WHERE/.test(sql)) return rows.attachments ?? [];
    if (/FROM ticket_description_edits WHERE/.test(sql)) return rows.descriptionEdits ?? [];
    if (/FROM comment_edits WHERE/.test(sql)) return rows.commentEdits ?? [];
    if (/FROM tags WHERE/.test(sql)) return rows.tags ?? [];
    if (/FROM organizations WHERE/.test(sql)) return rows.organizations ?? [];
    if (/FROM departments WHERE/.test(sql)) return rows.departments ?? [];
    if (/FROM projects WHERE/.test(sql)) return rows.projects ?? [];
    if (/FROM custom_field_definitions WHERE/.test(sql)) return rows.customFields ?? [];
    if (/FROM ticket_categories WHERE/.test(sql)) return rows.categories ?? [];
    if (/FROM mailboxes WHERE/.test(sql)) return rows.mailboxes ?? [];
    if (/FROM email_rules WHERE/.test(sql)) return rows.emailRules ?? [];
    if (/FROM webhooks WHERE/.test(sql)) return rows.webhooks ?? [];
    if (/SELECT "customDomain" FROM workspaces WHERE id/.test(sql)) return rows.ownDomain ?? [];
    if (/FROM workspaces w WHERE lower\(w\."customDomain"\)/.test(sql)) return rows.domainTaken ?? [];
    return [];
  };
}

const importLink = (entityType: string, sourceId: string, targetId: string) => ({ entityType, sourceId, targetId });

describe('ImportWorkspace identity', () => {
  const at = '2026-01-01T00:00:00.000Z';
  const alice = { email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' };

  it('links every entity it creates to the origin id the file gives it, in the same transaction', async () => {
    const qr = new FakeQueryRunner(answerFrom({}));
    const data = emptyExport({
      users: [alice],
      tags: [{ id: 'tag-src', originId: 'tag-origin', name: 'urgent', color: null, createdAt: at }],
      tickets: [{ ...ticket('t-src', null), originId: 't-origin' }],
      comments: [{ id: 'c-src', content: 'hi', ticketId: 't-src', authorEmail: 'alice@example.com', mentionedUserIds: [], createdAt: at }],
      descriptionEdits: [{ id: 'e-src', ticketId: 't-src', content: 'old', editedByEmail: 'alice@example.com', createdAt: at }],
    });

    await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    const ticketId = qr.find(/INSERT INTO tickets/)[0].params[0];
    const commentId = qr.find(/INSERT INTO comments/)[0].params[0];
    const tagId = qr.find(/INSERT INTO tags/)[0].params[0];
    const editId = qr.find(/INSERT INTO ticket_description_edits/)[0].params[0];
    expect(linksWritten(qr)).toEqual(expect.arrayContaining([
      ['ticket', 't-origin', ticketId],
      ['tag', 'tag-origin', tagId],
      // Without an origin id (a hand-made 1.17 file) the row's own id is its identity
      ['comment', 'c-src', commentId],
      ['ticket-description-edit', 'e-src', editId],
    ]));
    const [insert] = qr.find(/INSERT INTO workspace_import_links/);
    expect(insert.params[1]).toBe('ws-target');
    expect(insert.sql).toMatch(/ON CONFLICT \("workspaceId", "entityType", "sourceId"\)/);
    expect(qr.queries.indexOf(insert)).toBeGreaterThan(qr.queries.findIndex((q) => /INSERT INTO tickets/.test(q.sql)));
    expect(qr.committed).toBe(true);
  });

  it('matches a ticket renamed here through the link of the import that created it', async () => {
    const qr = new FakeQueryRunner(answerFrom({
      links: [importLink('ticket', 't-origin', 'existing-t')],
      tickets: [{ id: 'existing-t', name: 'Renamed here', reporterId: 'u-1', createdAt: at }],
    }));
    const data = emptyExport({ users: [alice], tickets: [{ ...ticket('t-src', null), originId: 't-origin' }] });

    const { result } = await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    expect(qr.find(/INSERT INTO tickets/)).toHaveLength(0);
    expect(result).toMatchObject({ ticketsImported: 0, ticketsAlreadyPresent: 1 });
  });

  it('matches content coming back to the workspace it was exported from by its own id, without a link', async () => {
    const qr = new FakeQueryRunner(answerFrom({
      tickets: [{ id: 'home-t', name: 'Renamed at home', reporterId: 'u-1', createdAt: '2025-06-01T00:00:00.000Z' }],
      tags: [{ id: 'home-tag', name: 'renamed' }],
    }));
    // Exported here, imported elsewhere (new ids), exported there: origin ids are this workspace's ids
    const data = emptyExport({
      users: [alice],
      tags: [{ id: 'b-tag', originId: 'home-tag', name: 'urgent', color: null, createdAt: at }],
      tickets: [{ ...ticket('b-t', null), originId: 'home-t', tagIds: ['b-tag'] }],
    });

    const { result } = await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    expect(qr.find(/INSERT INTO tickets/)).toHaveLength(0);
    expect(qr.find(/INSERT INTO tags/)).toHaveLength(0);
    expect(result.ticketsAlreadyPresent).toBe(1);
    expect(linksWritten(qr)).toEqual([]);
  });

  it('ignores a link whose target is gone, falls back to natural keys and replaces the link', async () => {
    const qr = new FakeQueryRunner(answerFrom({
      links: [importLink('ticket', 't-origin', 'deleted-t'), importLink('tag', 'tag-origin', 'deleted-tag')],
      tags: [{ id: 'tag-here', name: 'urgent' }],
    }));
    const data = emptyExport({
      users: [alice],
      tags: [{ id: 'tag-src', originId: 'tag-origin', name: 'urgent', color: null, createdAt: at }],
      tickets: [{ ...ticket('t-src', null), originId: 't-origin' }],
    });

    const { result } = await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    expect(result).toMatchObject({ ticketsImported: 1, tagsImported: 0 });
    const ticketId = qr.find(/INSERT INTO tickets/)[0].params[0];
    expect(linksWritten(qr)).toEqual(expect.arrayContaining([['ticket', 't-origin', ticketId], ['tag', 'tag-origin', 'tag-here']]));
    expect(qr.find(/INSERT INTO workspace_import_links/)[0].sql).toMatch(/DO UPDATE SET "targetId" = EXCLUDED\."targetId"/);
  });

  it('links what it matches by natural key, so the next import matches by identity', async () => {
    const qr = new FakeQueryRunner(answerFrom({
      tickets: [{ id: 'existing-t', name: 'Ticket t-src', reporterId: 'u-1', createdAt: at }],
      organizations: [{ id: 'org-here', name: 'Globex', logo: null }],
    }));
    const data = emptyExport({
      users: [alice],
      organizations: [{ id: 'org-src', originId: 'org-origin', name: 'Globex', description: null, notes: null, domains: [], createdAt: at }],
      tickets: [{ ...ticket('t-src', null), originId: 't-origin' }],
    });

    await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    expect(linksWritten(qr)).toEqual(expect.arrayContaining([['ticket', 't-origin', 'existing-t'], ['organization', 'org-origin', 'org-here']]));
  });

  it('prefers identity over names for organizations and tags renamed here', async () => {
    const qr = new FakeQueryRunner(answerFrom({
      links: [importLink('organization', 'org-origin', 'org-renamed'), importLink('tag', 'tag-origin', 'tag-renamed')],
      organizations: [{ id: 'org-renamed', name: 'Globex Corp', logo: null }],
      tags: [{ id: 'tag-renamed', name: 'very urgent' }],
    }));
    const data = emptyExport({
      users: [alice],
      organizations: [{ id: 'org-src', originId: 'org-origin', name: 'Globex', description: null, notes: null, domains: [], createdAt: at }],
      tags: [{ id: 'tag-src', originId: 'tag-origin', name: 'urgent', color: null, createdAt: at }],
      tickets: [{ ...ticket('t-src', null), organizationId: 'org-src', tagIds: ['tag-src'] }],
    });

    const { result } = await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    expect(result).toMatchObject({ organizationsImported: 0, tagsImported: 0 });
    expect(qr.find(/INSERT INTO tickets/)[0].params[20]).toBe('org-renamed');
    expect(qr.find(/INSERT INTO ticket_tag/)[0].params[1]).toBe('tag-renamed');
  });

  it('resolves a category whose slug changed here by identity, for tickets too', async () => {
    const qr = new FakeQueryRunner(answerFrom({
      links: [importLink('ticket-category', 'cat-origin', 'cat-here')],
      categories: [{ id: 'cat-here', slug: 'defect' }],
    }));
    const data = emptyExport({
      users: [alice],
      categories: [{ id: 'cat-src', originId: 'cat-origin', name: 'Bug', slug: 'bug', color: 'red', createdAt: at }],
      tickets: [ticket('t-src', 'bug')],
    });

    const { result } = await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    expect(result.categoriesImported).toBe(0);
    expect(qr.find(/INSERT INTO ticket_categories/)).toHaveLength(0);
    expect(qr.find(/INSERT INTO tickets/)[0].params[5]).toBe('cat-here');
  });

  it('stores no file for a ticket matched by identity', async () => {
    const qr = new FakeQueryRunner(answerFrom({
      links: [importLink('ticket', 't-origin', 'existing-t')],
      tickets: [{ id: 'existing-t', name: 'Renamed here', reporterId: 'u-1', createdAt: at }],
    }));
    const storage = new FakeS3Storage();
    const data = emptyExport({
      users: [alice],
      tickets: [{ ...ticket('t-src', null), originId: 't-origin' }],
      attachments: [{ id: 'a', fileName: 'a.pdf', originalName: 'a.pdf', mimeType: 'application/pdf', size: 3, file: 'files/a', ticketId: 't-src', commentId: null, uploadedByEmail: null, createdAt: at }],
    });

    const { result } = await new ImportWorkspace(dataSourceOf(qr), storage)
      .execute('ws-target', data, { files: archiveOf({ 'files/a': Buffer.from('aaa') }) });

    expect(storage.uploadedKeys).toEqual([]);
    expect(result).toMatchObject({ ticketsAlreadyPresent: 1, attachmentsOfExistingTickets: 1 });
  });

  it('gives no link to an id wider than the column, instead of failing the import', async () => {
    const qr = new FakeQueryRunner(answerFrom({}));
    const data = emptyExport({ users: [alice], tickets: [{ ...ticket('t-src', null), originId: 'x'.repeat(40) }] });

    const { result } = await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    expect(result.ticketsImported).toBe(1);
    expect(linksWritten(qr)).toEqual([]);
  });

  it('rejects an origin id that is not text', async () => {
    const qr = new FakeQueryRunner(answerFrom({}));
    const data = emptyExport({ users: [alice], tickets: [{ ...ticket('t-src', null), originId: 42 as unknown as string }] });
    await expect(new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data)).rejects.toThrow(/tickets\[0\]\.originId/);
  });
});

describe('ImportWorkspace completeExisting', () => {
  const at = '2026-01-01T00:00:00.000Z';
  const alice = { email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' };
  /** The ticket already in the target, matched through its link to the file's ticket. */
  const here = {
    links: [importLink('ticket', 't-origin', 'existing-t')],
    tickets: [{ id: 'existing-t', name: 'Renamed here', reporterId: 'u-1', createdAt: at }],
  };
  const fileTicket = (extra: Partial<WorkspaceExportData['tickets'][number]> = {}) => ({ ...ticket('t-src', null), originId: 't-origin', ...extra });
  const details = (extra: Record<string, unknown> = {}) => ({
    id: 'existing-t', departmentId: null, projectId: null, organizationId: null, registeredById: null,
    originDate: null, descriptionEditedAt: null, source: 'ui', customFields: {}, ...extra,
  });
  const run = async (rows: TableRows, data: WorkspaceExportData, completeExisting = true) => {
    const qr = new FakeQueryRunner(answerFrom({ ...here, ...rows }));
    const { result } = await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data, { completeExisting });
    return { qr, result };
  };

  it('fills only the empty fields of a ticket already here and never overwrites one that is set', async () => {
    const { qr, result } = await run({
      ticketDetails: [details({ projectId: 'p-here', originDate: new Date('2020-01-01T00:00:00.000Z'), customFields: { 'cf-here': 'keep' } })],
      departments: [{ id: 'dep-here', name: 'Billing' }],
      projects: [{ id: 'p-other', name: 'Website' }],
      customFields: [{ id: 'cf-here', name: 'Plan', type: 'text' }, { id: 'cf-two', name: 'Seats', type: 'number' }],
    }, emptyExport({
      users: [alice],
      departments: [{ id: 'd-src', name: 'Billing', description: null, memberEmails: [], createdAt: at }],
      projects: [{ id: 'p-src', name: 'Website', description: null, categorySlugs: [], createdAt: at }],
      customFields: [
        { id: 'cf-src-1', name: 'Plan', type: 'text', options: null, position: 0, required: false, createdAt: at },
        { id: 'cf-src-2', name: 'Seats', type: 'number', options: null, position: 1, required: false, createdAt: at },
      ],
      tickets: [fileTicket({
        name: 'Other name', status: 'resolved', priority: 'high', assigneeEmail: 'alice@example.com',
        departmentId: 'd-src', projectId: 'p-src', registeredByEmail: 'alice@example.com',
        originDate: '2024-01-01T00:00:00.000Z', descriptionEditedAt: '2026-02-01T00:00:00.000Z',
        customFields: { 'cf-src-1': 'overwrite me', 'cf-src-2': 5 },
      })],
    }));

    expect(qr.find(/INSERT INTO tickets/)).toHaveLength(0);
    const updates = qr.find(/UPDATE tickets SET/);
    expect(updates).toHaveLength(1);
    const [{ sql, params }] = updates;
    expect(params[0]).toBe('existing-t');
    expect(sql).toMatch(/WHERE id = \$1$/);
    for (const column of ['departmentId', 'registeredById', 'descriptionEditedAt']) {
      expect(sql).toMatch(new RegExp(`"${column}" = COALESCE\\("${column}", \\$\\d+\\)`));
    }
    for (const untouched of ['"projectId"', '"originDate"', 'name', 'status', 'priority', '"assigneeId"', '"categoryId"', '"reporterId"', '"ticketNumber"', 'source']) {
      expect(sql).not.toMatch(new RegExp(`${untouched} =`));
    }
    expect(params).toEqual(expect.arrayContaining(['dep-here', 'u-1', '2026-02-01T00:00:00.000Z']));
    // Only the key the ticket lacks, and the ticket's own value wins in SQL too
    expect(sql).toMatch(/"customFields" = \$\d+::jsonb \|\| COALESCE\("customFields", '\{\}'::jsonb\)/);
    expect(params).toContain(JSON.stringify({ 'cf-two': 5 }));
    expect(result).toMatchObject({ ticketsImported: 0, ticketsCompleted: 1, ticketsAlreadyPresent: 0 });
  });

  it('replaces source only when the ticket has the default ui and the file names another channel', async () => {
    const changed = await run({ ticketDetails: [details({ source: 'ui' })] }, emptyExport({ users: [alice], tickets: [fileTicket({ source: 'email' })] }));
    const [update] = changed.qr.find(/UPDATE tickets SET/);
    expect(update.sql).toMatch(/source = CASE WHEN source = 'ui' THEN \$2 ELSE source END/);
    expect(update.params).toEqual(['existing-t', 'email']);

    const kept = await run({ ticketDetails: [details({ source: 'portal' })] }, emptyExport({ users: [alice], tickets: [fileTicket({ source: 'email' })] }));
    expect(kept.qr.find(/UPDATE tickets SET/)).toHaveLength(0);
    const same = await run({ ticketDetails: [details({ source: 'ui' })] }, emptyExport({ users: [alice], tickets: [fileTicket({ source: 'ui' })] }));
    expect(same.qr.find(/UPDATE tickets SET/)).toHaveLength(0);
    expect(same.result).toMatchObject({ ticketsCompleted: 0, ticketsAlreadyPresent: 1 });
  });

  it('adds only the tags the ticket lacks', async () => {
    const { qr, result } = await run({
      ticketDetails: [details()],
      ticketTags: [{ ticketsId: 'existing-t', tagsId: 'tag-a' }],
      tags: [{ id: 'tag-a', name: 'a' }, { id: 'tag-b', name: 'b' }],
    }, emptyExport({
      users: [alice],
      tags: [{ id: 'src-a', name: 'a', color: null, createdAt: at }, { id: 'src-b', name: 'b', color: null, createdAt: at }],
      tickets: [fileTicket({ tagIds: ['src-a', 'src-b'] })],
    }));

    expect(qr.find(/INSERT INTO ticket_tag/).map((q) => q.params)).toEqual([['existing-t', 'tag-b']]);
    expect(result.ticketsCompleted).toBe(1);
  });

  it('adds the comments, edits and participants the ticket lacks, matching legacy ones by author or editor and second', async () => {
    const later = '2026-01-02T00:00:00.000Z';
    let participantInserts = 0;
    const qr = new FakeQueryRunner((sql, params) => {
      if (/INSERT INTO ticket_participants/.test(sql)) return participantInserts++ === 0 ? [] : [{ id: 'p-new' }];
      return answerFrom({
        ...here,
        links: [...here.links, importLink('comment', 'c-linked', 'existing-c1')],
        ticketDetails: [details()],
        comments: [
          { id: 'existing-c1', ticketId: 'existing-t', authorId: 'u-1', createdAt: new Date('2025-01-01T00:00:00.000Z') },
          // Imported before links existed: same author, same second
          { id: 'existing-c2', ticketId: 'existing-t', authorId: 'u-1', createdAt: new Date('2026-01-01T00:00:00.400Z') },
        ],
        descriptionEdits: [{ id: 'existing-e1', parentId: 'existing-t', editedById: 'u-1', createdAt: new Date(at) }],
        commentEdits: [{ id: 'existing-ce1', parentId: 'existing-c2', editedById: 'u-1', createdAt: new Date(at) }],
      })(sql, params);
    });
    const comment = (id: string, createdAt: string) => ({ id, originId: id, content: id, ticketId: 't-src', authorEmail: 'alice@example.com', mentionedUserIds: [], createdAt });
    const data = emptyExport({
      users: [alice],
      tickets: [fileTicket()],
      comments: [comment('c-linked', later), comment('c-legacy', at), comment('c-new', later)],
      descriptionEdits: [
        { id: 'e-legacy', ticketId: 't-src', content: 'old', editedByEmail: 'alice@example.com', createdAt: at },
        { id: 'e-new', ticketId: 't-src', content: 'older', editedByEmail: 'alice@example.com', createdAt: later },
      ],
      commentEdits: [
        { id: 'ce-legacy', commentId: 'c-legacy', content: 'x', editedByEmail: 'alice@example.com', createdAt: at },
        { id: 'ce-new', commentId: 'c-legacy', content: 'y', editedByEmail: 'alice@example.com', createdAt: later },
        { id: 'ce-on-new', commentId: 'c-new', content: 'z', editedByEmail: 'alice@example.com', createdAt: later },
      ],
      participants: [
        { ticketId: 't-src', userEmail: 'alice@example.com', role: 'follower' },
        { ticketId: 't-src', userEmail: 'alice@example.com', role: 'collaborator' },
      ],
    });

    const { result } = await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data, { completeExisting: true });

    const commentInserts = qr.find(/INSERT INTO comments/);
    expect(commentInserts.map((q) => [q.params[1], q.params[2]])).toEqual([['c-new', 'existing-t']]);
    const newCommentId = commentInserts[0].params[0];
    expect(qr.find(/INSERT INTO ticket_description_edits/).map((q) => [q.params[1], q.params[2]])).toEqual([['older', 'existing-t']]);
    expect(qr.find(/INSERT INTO comment_edits/).map((q) => [q.params[1], q.params[2]])).toEqual([['y', 'existing-c2'], ['z', newCommentId]]);
    expect(result).toMatchObject({
      commentsImported: 1, descriptionEditsImported: 1, commentEditsImported: 2, participantsImported: 1,
      ticketsCompleted: 1, ticketsAlreadyPresent: 0,
    });
    // What was already there is linked too, so the next import matches it by identity
    expect(linksWritten(qr)).toEqual(expect.arrayContaining([
      ['comment', 'c-legacy', 'existing-c2'],
      ['comment', 'c-new', newCommentId],
      ['ticket-description-edit', 'e-legacy', 'existing-e1'],
      ['comment-edit', 'ce-legacy', 'existing-ce1'],
    ]));
    expect(qr.find(/UPDATE comments|DELETE FROM/)).toHaveLength(0);
  });

  it('adds nothing on a third import once every child is linked', async () => {
    const { qr, result } = await run({
      links: [...here.links, importLink('comment', 'c-1', 'existing-c1'), importLink('ticket-description-edit', 'e-1', 'existing-e1')],
      ticketDetails: [details({ source: 'email', departmentId: 'x' })],
      comments: [{ id: 'existing-c1', ticketId: 'existing-t', authorId: 'u-1', createdAt: new Date('2020-01-01T00:00:00.000Z') }],
      descriptionEdits: [{ id: 'existing-e1', parentId: 'existing-t', editedById: 'u-1', createdAt: new Date('2020-01-01T00:00:00.000Z') }],
    }, emptyExport({
      users: [alice],
      tickets: [fileTicket({ source: 'email' })],
      comments: [{ id: 'c-1', content: 'hi', ticketId: 't-src', authorEmail: 'alice@example.com', mentionedUserIds: [], createdAt: at }],
      descriptionEdits: [{ id: 'e-1', ticketId: 't-src', content: 'old', editedByEmail: 'alice@example.com', createdAt: at }],
    }));

    expect(qr.find(/INSERT INTO (comments|ticket_description_edits|tickets)\b|UPDATE tickets/)).toHaveLength(0);
    expect(result).toMatchObject({ ticketsCompleted: 0, ticketsAlreadyPresent: 1, commentsImported: 0 });
  });

  it('leaves tickets already here alone when the option is off, as before', async () => {
    const { qr, result } = await run({ ticketDetails: [details()] }, emptyExport({
      users: [alice],
      tickets: [fileTicket({ source: 'email', registeredByEmail: 'alice@example.com' })],
      comments: [{ id: 'c-1', content: 'hi', ticketId: 't-src', authorEmail: 'alice@example.com', mentionedUserIds: [], createdAt: at }],
      participants: [{ ticketId: 't-src', userEmail: 'alice@example.com', role: 'follower' }],
      attachments: [{ id: 'a', fileName: 'a', originalName: 'a', mimeType: 'text/plain', size: 1, file: 'files/a', ticketId: 't-src', commentId: null, uploadedByEmail: null, createdAt: at }],
    }), false);

    expect(qr.find(/UPDATE tickets|INSERT INTO comments|INSERT INTO ticket_participants|FROM tickets WHERE id = ANY/)).toHaveLength(0);
    expect(result).toMatchObject({ ticketsCompleted: 0, ticketsAlreadyPresent: 1, attachmentsOfExistingTickets: 1, commentsImported: 0 });
  });

  describe('attachments', () => {
    const attachment = (id: string, originalName: string, size: number, file: string) => ({
      id, originId: id, fileName: originalName, originalName, mimeType: 'application/pdf', size, file,
      ticketId: 't-src', commentId: null, uploadedByEmail: null, createdAt: at,
    });
    const data = (extra: Partial<WorkspaceExportData> = {}) => emptyExport({
      users: [alice],
      tickets: [fileTicket()],
      attachments: [attachment('a-legacy', 'a.pdf', 3, 'files/a'), attachment('a-new', 'b.pdf', 2, 'files/b')],
      ...extra,
    });
    const files = archiveOf({ 'files/a': Buffer.from('aaa'), 'files/b': Buffer.from('bb') });
    const rows = {
      ...here,
      ticketDetails: [details()],
      attachments: [{ id: 'existing-a', ticketId: 'existing-t', originalName: 'a.pdf', size: 3 }],
    };

    it('stores only the files the ticket lacks, under fresh keys, and adds them to it', async () => {
      const qr = new FakeQueryRunner(answerFrom(rows));
      const storage = new FakeS3Storage();

      const { result } = await new ImportWorkspace(dataSourceOf(qr), storage).execute('ws-target', data(), { files, completeExisting: true });

      expect(storage.uploadedKeys).toHaveLength(1);
      const [insert] = qr.find(/INSERT INTO attachments/);
      const [newId, , originalName, , size, key, ticketId] = insert.params as string[];
      expect([originalName, size, ticketId]).toEqual(['b.pdf', 2, 'existing-t']);
      expect(key).toBe(`attachments/${newId}/b.pdf`);
      expect(storage.uploadedKeys).toEqual([key]);
      expect(storage.read(key)?.toString()).toBe('bb');
      expect(qr.find(/INSERT INTO attachments/)).toHaveLength(1);
      expect(result).toMatchObject({ attachmentsImported: 1, attachmentsOfExistingTickets: 0, ticketsCompleted: 1 });
      expect(linksWritten(qr)).toEqual(expect.arrayContaining([['attachment', 'a-legacy', 'existing-a'], ['attachment', 'a-new', newId]]));
    });

    it('deletes the files it stored for a completed ticket when the transaction rolls back', async () => {
      const qr = new FakeQueryRunner((sql, params) => {
        if (/INSERT INTO workspace_import_links/.test(sql)) throw new Error('database went away');
        return answerFrom(rows)(sql, params);
      });
      const storage = new FakeS3Storage();

      await expect(new ImportWorkspace(dataSourceOf(qr), storage).execute('ws-target', data(), { files, completeExisting: true }))
        .rejects.toThrow('database went away');

      expect(qr.rolledBack).toBe(true);
      expect(storage.uploadedKeys).toHaveLength(1);
      expect(storage.keys()).toEqual([]);
    });

    it('stores nothing for a ticket already here when the option is off', async () => {
      const qr = new FakeQueryRunner(answerFrom(rows));
      const storage = new FakeS3Storage();

      const { result } = await new ImportWorkspace(dataSourceOf(qr), storage).execute('ws-target', data(), { files });

      expect(storage.uploadedKeys).toEqual([]);
      expect(result).toMatchObject({ attachmentsImported: 0, attachmentsOfExistingTickets: 2 });
    });
  });
});

describe('ImportWorkspace configuration', () => {
  const at = '2026-01-01T00:00:00.000Z';
  const alice = { id: 'u-src', email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' };
  const mailbox = (extra: Partial<WorkspaceExportData['mailboxes'][number]> = {}): WorkspaceExportData['mailboxes'][number] => ({
    id: 'mb-src', originId: 'mb-origin', address: 'support@acme.com', type: 'imap', imapHost: 'imap.acme.com', imapPort: 993,
    imapUser: 'support', encryption: 'tls', imapFolder: 'INBOX', pollInterval: 30, addressMode: 'all',
    acceptedAddresses: [], autoReply: true, postProcessAction: 'none', postProcessFolder: null, ...extra,
  });
  const rule = (extra: Partial<WorkspaceExportData['emailRules'][number]> = {}): WorkspaceExportData['emailRules'][number] => ({
    id: 'r-src', originId: 'r-origin', name: 'Billing', position: 2, isActive: true,
    conditions: [{ field: 'subject', operator: 'contains', value: 'invoice' }],
    actions: [], mailboxOriginIds: [], ...extra,
  });
  const run = async (rows: TableRows, data: WorkspaceExportData, options: Parameters<ImportWorkspace['execute']>[2] = {}) => {
    const qr = new FakeQueryRunner(answerFrom(rows));
    const { result } = await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data, options);
    return { qr, result };
  };

  describe('mailboxes', () => {
    it('creates mailboxes paused, with no IMAP password when the file carries none, and links them', async () => {
      const { qr, result } = await run({}, emptyExport({ mailboxes: [mailbox()] }));

      const [insert] = qr.find(/INSERT INTO mailboxes/);
      expect(insert.sql).toMatch(/VALUES \(\$1, \$2, \$3, false,/);
      const [id, address, workspaceId, type, host, port, user, pass] = insert.params;
      expect([address, workspaceId, type, host, port, user, pass]).toEqual(['support@acme.com', 'ws-target', 'imap', 'imap.acme.com', 993, 'support', null]);
      expect(result.mailboxesImported).toBe(1);
      expect(result.credentialsIncluded).toBe(false);
      expect(linksWritten(qr)).toContainEqual(['mailbox', 'mb-origin', id]);
    });

    it('stores the IMAP password a file with credentials carries, still paused', async () => {
      const { qr, result } = await run({}, emptyExport({ credentialsIncluded: true, mailboxes: [mailbox({ imapPass: 'secret' })] }));

      const [insert] = qr.find(/INSERT INTO mailboxes/);
      expect(insert.params[7]).toBe('secret');
      expect(insert.sql).toMatch(/\$3, false,/);
      expect(result.credentialsIncluded).toBe(true);
    });

    it('reuses a mailbox of the target with the same address, leaving it untouched', async () => {
      const { qr, result } = await run(
        { mailboxes: [{ id: 'mb-here', address: 'Support@Acme.com' }] },
        emptyExport({ mailboxes: [mailbox()] }),
      );

      expect(qr.find(/INSERT INTO mailboxes/)).toHaveLength(0);
      expect(qr.find(/UPDATE mailboxes/)).toHaveLength(0);
      expect(result.mailboxesImported).toBe(0);
      expect(linksWritten(qr)).toContainEqual(['mailbox', 'mb-origin', 'mb-here']);
    });

    it('points new tickets at the target mailbox and fills the mailbox of a completed ticket only when empty', async () => {
      const created = await run(
        { mailboxes: [{ id: 'mb-here', address: 'support@acme.com' }] },
        emptyExport({ users: [alice], mailboxes: [mailbox()], tickets: [{ ...ticket('t-1', null), mailboxOriginId: 'mb-origin' }] }),
      );
      const [ticketInsert] = created.qr.find(/INSERT INTO tickets/);
      expect(ticketInsert.sql).toMatch(/"mailboxId", reference\n/);
      expect(ticketInsert.params[27]).toBe('mb-here');

      const here = {
        mailboxes: [{ id: 'mb-here', address: 'support@acme.com' }],
        links: [importLink('ticket', 't-origin', 'existing-t')],
        tickets: [{ id: 'existing-t', name: 'Here', reporterId: 'u-1', createdAt: at }],
      };
      const fileTicket = { ...ticket('t-src', null), originId: 't-origin', mailboxOriginId: 'mb-origin' };
      const details = (mailboxId: string | null) => [{ id: 'existing-t', source: 'ui', customFields: {}, mailboxId }];
      const filled = await run({ ...here, ticketDetails: details(null) },
        emptyExport({ users: [alice], mailboxes: [mailbox()], tickets: [fileTicket] }), { completeExisting: true });
      const [update] = filled.qr.find(/UPDATE tickets SET/);
      expect(update.sql).toMatch(/"mailboxId" = COALESCE\("mailboxId", \$2\)/);
      expect(update.params).toEqual(['existing-t', 'mb-here']);

      const kept = await run({ ...here, ticketDetails: details('mb-other') },
        emptyExport({ users: [alice], mailboxes: [mailbox()], tickets: [fileTicket] }), { completeExisting: true });
      expect(kept.qr.find(/UPDATE tickets SET/)).toHaveLength(0);
    });

    it('rejects a mailbox of an unknown type', async () => {
      await expect(run({}, emptyExport({ mailboxes: [mailbox({ type: 'pop3' })] })))
        .rejects.toThrow('Invalid export file: mailboxes[0].type must be one of: webhook, imap');
    });
  });

  describe('email rules', () => {
    it('remaps mailboxes and action values to the target, dropping what has no counterpart, and keeps isActive', async () => {
      const { qr, result } = await run(
        { departments: [{ id: 'dep-here', name: 'Billing' }], tags: [{ id: 'tag-here', name: 'vip' }] },
        emptyExport({
          users: [alice],
          departments: [{ id: 'dep-src', name: 'Billing', description: null, memberEmails: [], createdAt: at }],
          tags: [{ id: 'tag-src', name: 'vip', color: null, createdAt: at }],
          mailboxes: [mailbox()],
          emailRules: [rule({
            isActive: false,
            mailboxOriginIds: ['mb-origin', 'mb-unknown'],
            actions: [
              { type: 'set-department', value: 'dep-src' },
              { type: 'add-tags', value: 'tag-src,tag-unknown' },
              { type: 'assign-to', value: 'u-src' },
              { type: 'set-organization', value: 'org-unknown' },
              { type: 'set-priority', value: 'high' },
            ],
          })],
        }),
      );

      const mailboxId = qr.find(/INSERT INTO mailboxes/)[0].params[0];
      const [insert] = qr.find(/INSERT INTO email_rules/);
      const [id, workspaceId, name, position, isActive, mailboxIds, conditions, actions] = insert.params as string[];
      expect([workspaceId, name, position, isActive]).toEqual(['ws-target', 'Billing', 2, false]);
      expect(JSON.parse(mailboxIds)).toEqual([mailboxId]);
      expect(JSON.parse(conditions)).toEqual([{ field: 'subject', operator: 'contains', value: 'invoice' }]);
      expect(JSON.parse(actions)).toEqual([
        { type: 'set-department', value: 'dep-here' },
        { type: 'add-tags', value: 'tag-here' },
        { type: 'assign-to', value: 'u-1' },
        { type: 'set-priority', value: 'high' },
      ]);
      expect(qr.queries.findIndex((q) => /INSERT INTO email_rules/.test(q.sql)))
        .toBeGreaterThan(qr.queries.findIndex((q) => /INSERT INTO mailboxes/.test(q.sql)));
      expect(result.emailRulesImported).toBe(1);
      expect(linksWritten(qr)).toContainEqual(['email-rule', 'r-origin', id]);
    });

    it('creates inactive a rule limited to mailboxes none of which could be mapped, so it never widens to all', async () => {
      const { qr } = await run({}, emptyExport({ emailRules: [rule({ isActive: true, mailboxOriginIds: ['mb-gone'] })] }));

      const [insert] = qr.find(/INSERT INTO email_rules/);
      expect(insert.params[4]).toBe(false);
      expect(insert.params[5]).toBe('[]');
    });

    it('reuses a rule with the same name instead of duplicating it', async () => {
      const { qr, result } = await run({ emailRules: [{ id: 'r-here', name: 'Billing' }] }, emptyExport({ emailRules: [rule()] }));

      expect(qr.find(/INSERT INTO email_rules/)).toHaveLength(0);
      expect(result.emailRulesImported).toBe(0);
      expect(linksWritten(qr)).toContainEqual(['email-rule', 'r-origin', 'r-here']);
    });

    it('rejects a rule with an unknown action', async () => {
      await expect(run({}, emptyExport({ emailRules: [rule({ actions: [{ type: 'forward' }] })] })))
        .rejects.toThrow('Invalid export file: emailRules[0].actions[0].type must be one of');
    });
  });

  describe('webhooks', () => {
    const webhook = (extra: Partial<WorkspaceExportData['webhooks'][number]> = {}) => ({
      id: 'wh-src', originId: 'wh-origin', url: 'https://hooks.acme.com/x', events: ['ticket.created', 'comment.created'], ...extra,
    });

    it('creates webhooks inactive with a new random secret when the file carries none', async () => {
      const { qr, result } = await run({}, emptyExport({ webhooks: [webhook()] }));

      const [insert] = qr.find(/INSERT INTO webhooks/);
      expect(insert.sql).toMatch(/VALUES \(\$1, \$2, \$3, \$4, \$5, false\)/);
      const [id, workspaceId, url, events, secret] = insert.params as string[];
      expect([workspaceId, url, events]).toEqual(['ws-target', 'https://hooks.acme.com/x', 'ticket.created,comment.created']);
      expect(secret).toMatch(/^[0-9a-f]{64}$/);
      expect(result.webhooksImported).toBe(1);
      expect(linksWritten(qr)).toContainEqual(['webhook', 'wh-origin', id]);
    });

    it('keeps the secret a file with credentials carries', async () => {
      const { qr } = await run({}, emptyExport({ credentialsIncluded: true, webhooks: [webhook({ secret: 'hook-secret' })] }));
      expect(qr.find(/INSERT INTO webhooks/)[0].params[4]).toBe('hook-secret');
    });

    it('reuses a webhook of the target with the same URL, leaving it untouched', async () => {
      const { qr, result } = await run({ webhooks: [{ id: 'wh-here', url: 'https://hooks.acme.com/x' }] }, emptyExport({ webhooks: [webhook()] }));

      expect(qr.find(/INSERT INTO webhooks|UPDATE webhooks/)).toHaveLength(0);
      expect(result.webhooksImported).toBe(0);
    });

    it('rejects a webhook URL that is not http or https', async () => {
      await expect(run({}, emptyExport({ webhooks: [webhook({ url: 'file:///etc/passwd' })] })))
        .rejects.toThrow('Invalid export file: webhooks[0].url must be an http or https URL');
    });
  });

  describe('email sender', () => {
    const sender = (extra: Partial<NonNullable<WorkspaceExportData['emailSender']>> = {}) => ({
      smtpHost: 'smtp.acme.com', smtpPort: 587, smtpUser: 'mailer', smtpFrom: 'no-reply@acme.com', encryption: 'tls',
      fromName: 'Acme', fromEmail: null, ...extra,
    });

    it('is left alone unless emailSender is overwritten', async () => {
      const { qr, result } = await run({}, emptyExport({ credentialsIncluded: true, emailSender: sender({ smtpPass: 'p' }) }));
      expect(qr.find(/workspace_email_senders/)).toHaveLength(0);
      expect(result.settingsApplied).toEqual([]);
    });

    it('replaces the target sender when overwritten and the file carries its password', async () => {
      const { qr, result } = await run({}, emptyExport({ credentialsIncluded: true, emailSender: sender({ smtpPass: 'p' }) }), { overwrite: ['emailSender'] });

      const [upsert] = qr.find(/INSERT INTO workspace_email_senders/);
      expect(upsert.sql).toMatch(/ON CONFLICT \("workspaceId"\) DO UPDATE SET/);
      expect(upsert.params.slice(1)).toEqual(['ws-target', 'smtp.acme.com', 587, 'mailer', 'p', 'no-reply@acme.com', 'tls', 'Acme', null]);
      expect(result.settingsApplied).toEqual(['emailSender']);
    });

    it('is not applied without a password, so the workspace keeps sending through its current sender', async () => {
      const { qr, result } = await run({}, emptyExport({ emailSender: sender() }), { overwrite: ['emailSender'] });
      expect(qr.find(/workspace_email_senders/)).toHaveLength(0);
      expect(result.settingsApplied).toEqual([]);
    });
  });

  describe('custom domain and name', () => {
    it('are left alone unless overwritten', async () => {
      const { qr, result } = await run({}, emptyExport({ customDomain: 'help.acme.com' }));
      expect(qr.find(/UPDATE workspaces/)).toHaveLength(0);
      expect(result.customDomainSkipped).toBeNull();
    });

    it('sets the custom domain unverified with a new verification token, and the name', async () => {
      const { qr, result } = await run({}, emptyExport({ customDomain: 'Help.Acme.com' }), { overwrite: ['customDomain', 'name'] });

      const [update] = qr.find(/UPDATE workspaces/);
      expect(update.sql).toBe('UPDATE workspaces SET name = $2, "customDomain" = $3, "customDomainVerified" = false, "domainVerificationToken" = $4 WHERE id = $1');
      expect(update.params.slice(0, 3)).toEqual(['ws-target', 'Acme', 'help.acme.com']);
      expect(update.params[3]).toMatch(/^oh-verify=[0-9a-f]{32}$/);
      expect(result.settingsApplied).toEqual(['name', 'customDomain']);
      expect(result.customDomainSkipped).toBeNull();
    });

    it('skips a custom domain another workspace already uses, saying what to do without naming a workspace the importer is not in', async () => {
      const { qr, result } = await run(
        { domainTaken: [{ id: 'ws-other', name: 'Other Co', isMember: false }] },
        emptyExport({ customDomain: 'help.acme.com' }),
        { overwrite: ['customDomain'], importer: { userId: 'u-importer', isSystemAdmin: false } },
      );

      const [check] = qr.find(/lower\(w\."customDomain"\)/);
      expect(check.params).toEqual(['help.acme.com', 'ws-target', 'u-importer']);
      expect(qr.find(/UPDATE workspaces/)).toHaveLength(0);
      expect(result.customDomainSkipped).toBe(
        '"help.acme.com" is used by another workspace. Remove it there (Settings → Custom Domain) and import again with only "Set the custom domain" ticked.',
      );
      expect(result.settingsApplied).toEqual([]);
    });

    it('names the workspace that holds the custom domain to a member of it or a system admin', async () => {
      const expected = '"help.acme.com" is used by workspace "Other Co". Remove it there (Settings → Custom Domain) and import again with only "Set the custom domain" ticked.';
      const member = await run(
        { domainTaken: [{ id: 'ws-other', name: 'Other Co', isMember: true }] },
        emptyExport({ customDomain: 'help.acme.com' }),
        { overwrite: ['customDomain'], importer: { userId: 'u-importer', isSystemAdmin: false } },
      );
      expect(member.result.customDomainSkipped).toBe(expected);

      const admin = await run(
        { domainTaken: [{ id: 'ws-other', name: 'Other Co', isMember: false }] },
        emptyExport({ customDomain: 'help.acme.com' }),
        { overwrite: ['customDomain'], importer: { userId: 'u-admin', isSystemAdmin: true } },
      );
      expect(admin.result.customDomainSkipped).toBe(expected);
    });

    it('skips the platform host and keeps a domain the workspace already has, verified as it is', async () => {
      const platform = await run({}, emptyExport({ customDomain: 'desk.example.com' }), { overwrite: ['customDomain'], primaryHost: 'desk.example.com' });
      expect(platform.result.customDomainSkipped).toBe('"desk.example.com" is the platform\'s own URL');

      const same = await run({ ownDomain: [{ customDomain: 'help.acme.com' }] }, emptyExport({ customDomain: 'help.acme.com' }), { overwrite: ['customDomain'] });
      expect(same.qr.find(/UPDATE workspaces/)).toHaveLength(0);
      expect(same.result.settingsApplied).toEqual(['customDomain']);
    });
  });

  it('points audit entries about mailboxes and webhooks at the ones it created or reused', async () => {
    const { qr } = await run({ webhooks: [{ id: 'wh-here', url: 'https://hooks.acme.com/x' }] }, emptyExport({
      mailboxes: [mailbox()],
      webhooks: [{ id: 'wh-src', originId: 'wh-src', url: 'https://hooks.acme.com/x', events: [] }],
      auditLog: [
        { action: 'mailbox-created', entityType: 'mailbox', entityId: 'mb-src', userEmail: null, metadata: { mailboxId: 'mb-src' }, createdAt: at },
        { action: 'webhook-created', entityType: 'webhook', entityId: 'wh-src', userEmail: null, metadata: null, createdAt: at },
      ],
    }));

    const mailboxId = qr.find(/INSERT INTO mailboxes/)[0].params[0];
    const audits = qr.find(/INSERT INTO audit_log_entries/);
    expect(audits.map((q) => q.params[3])).toEqual([mailboxId, 'wh-here']);
    expect(withoutImportMark(audits[0].params[6])).toEqual({ mailboxId });
  });

  it('imports a 1.17 file, which carries no configuration, as before', async () => {
    const legacy = emptyExport({ version: '1.17.0', users: [alice], tickets: [ticket('t-1', null)] }) as Partial<WorkspaceExportData>;
    for (const section of ['mailboxes', 'emailRules', 'emailSender', 'webhooks', 'customDomain', 'credentialsIncluded'] as const) delete legacy[section];

    const { qr, result } = await run({}, legacy as WorkspaceExportData, { overwrite: ['emailSender', 'customDomain', 'name'] });

    expect(qr.find(/INSERT INTO (mailboxes|email_rules|webhooks|workspace_email_senders)/)).toHaveLength(0);
    expect(result).toMatchObject({
      ticketsImported: 1, mailboxesImported: 0, emailRulesImported: 0, webhooksImported: 0,
      customDomainSkipped: null, credentialsIncluded: false, settingsApplied: ['name'],
    });
  });
});

describe('workspace analytics in exports', () => {
  const stored = {
    provider: 'matomo', serverUrl: 'https://stats.acme.com/', siteId: '4', useCookies: true, trackEvents: false, shareWithInstallation: false,
  };
  const run = async (data: WorkspaceExportData, overwrite: string[] = []) => {
    const qr = new FakeQueryRunner(answerFrom({}));
    const { result } = await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data, { overwrite });
    return { qr, result };
  };

  it('exports the workspace analytics scoped to the workspace, and null when it has none', async () => {
    const qr = new FakeQueryRunner((sql) => {
      if (/FROM workspaces WHERE id/.test(sql)) return [{ name: 'Acme', description: '', slaPolicy: null, metadata: null }];
      if (/FROM workspace_analytics_settings WHERE/.test(sql)) return [stored];
      return [];
    });
    const result = await new ExportWorkspace(dataSourceOf(qr)).execute('ws-1');

    const [query] = qr.find(/FROM workspace_analytics_settings WHERE/);
    expect(query.sql).toMatch(/"workspaceId" = \$1/);
    expect(query.params).toEqual(['ws-1']);
    expect(result.version).toBe(CURRENT_VERSION);
    expect(result.analytics).toEqual(stored);

    const none = await new ExportWorkspace(dataSourceOf(new FakeQueryRunner((sql) => (
      /FROM workspaces WHERE id/.test(sql) ? [{ name: 'Acme', description: '', slaPolicy: null, metadata: null }] : []
    )))).execute('ws-1');
    expect(none.analytics).toBeNull();
  });

  it('upgrades a 1.18 file, which carries no analytics, to 1.19 with none', () => {
    const legacy = emptyExport({ version: '1.18.0' }) as Partial<WorkspaceExportData>;
    delete legacy.analytics;
    const upgraded = applyTransforms(legacy as WorkspaceExportData);
    expect(upgraded.version).toBe(CURRENT_VERSION);
    expect(CURRENT_VERSION).toBe('1.21.0');
    expect(upgraded.analytics).toBeNull();
  });

  it('previews the analytics the file carries', () => {
    expect(buildImportPreview(emptyExport({ analytics: stored })).settings.analytics).toEqual({
      provider: 'matomo', serverUrl: 'https://stats.acme.com/', siteId: '4', shareWithInstallation: false,
    });
    const off = { ...stored, provider: null, serverUrl: null, siteId: null };
    expect(buildImportPreview(emptyExport({ analytics: off })).settings.analytics).toEqual({
      provider: null, serverUrl: null, siteId: null, shareWithInstallation: false,
    });
  });

  it('leaves the target analytics alone unless overwritten, or when the file has none', async () => {
    const { qr, result } = await run(emptyExport({ analytics: stored }));
    expect(qr.find(/workspace_analytics_settings/)).toHaveLength(0);
    expect(result.settingsApplied).toEqual([]);

    const empty = await run(emptyExport(), ['analytics']);
    expect(empty.qr.find(/workspace_analytics_settings/)).toHaveLength(0);
    expect(empty.result.settingsApplied).toEqual([]);
  });

  it('replaces the target analytics when overwritten, normalised and keyed by workspace', async () => {
    const { qr, result } = await run(emptyExport({ analytics: { ...stored, serverUrl: 'https://Stats.Acme.com/m', siteId: ' 4 ' } }), ['analytics']);

    const [upsert] = qr.find(/INSERT INTO workspace_analytics_settings/);
    expect(upsert.sql).toMatch(/ON CONFLICT \("workspaceId"\) DO UPDATE SET/);
    expect(upsert.params.slice(1)).toEqual(['ws-target', 'matomo', 'https://stats.acme.com/m/', '4', true, false, false]);
    expect(result.settingsApplied).toEqual(['analytics']);
  });

  it('applies a file whose source had no Matomo as off, keeping its share flag', async () => {
    const { qr } = await run(emptyExport({ analytics: { ...stored, provider: null } }), ['analytics']);
    const [upsert] = qr.find(/INSERT INTO workspace_analytics_settings/);
    expect(upsert.params.slice(1)).toEqual(['ws-target', null, null, null, false, true, false]);
  });

  it.each([
    [{ provider: 'ga' }, 'analytics.provider'],
    [{ serverUrl: 'http://stats.acme.com/' }, 'analytics.serverUrl'],
    [{ siteId: 'x' }, 'analytics.siteId'],
    [{ shareWithInstallation: 'yes' }, 'analytics.shareWithInstallation'],
  ])('rejects analytics %p before touching the database', async (patch, field) => {
    const data = emptyExport({ analytics: { ...stored, ...patch } as WorkspaceExportData['analytics'] });
    await expect(run(data, ['analytics'])).rejects.toThrow(field);
  });
});

describe('ticket reference format in exports', () => {
  const secret = 'a'.repeat(64);
  const run = async (data: WorkspaceExportData, overwrite: string[] = []) => {
    const qr = new FakeQueryRunner(answerFrom({}));
    const { result } = await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data, { overwrite });
    return { qr, result };
  };

  it('exports the format with its key, so a moved workspace shows the same references', async () => {
    const qr = new FakeQueryRunner((sql) => {
      if (/FROM workspaces WHERE id/.test(sql)) return [{ name: 'Acme', description: '', slaPolicy: null, metadata: null }];
      if (/FROM workspace_ticket_references WHERE/.test(sql)) return [{ style: 'random', prefix: 'ACME', secret }];
      return [];
    });
    const result = await new ExportWorkspace(dataSourceOf(qr)).execute('ws-1');
    expect(result.ticketReference).toEqual({ style: 'random', prefix: 'ACME', secret });
    const [query] = qr.find(/FROM workspace_ticket_references WHERE/);
    expect(query.params).toEqual(['ws-1']);
  });

  it('upgrades a 1.19 file, which carries none, with the default format', () => {
    const legacy = emptyExport({ version: '1.19.0' }) as Partial<WorkspaceExportData>;
    delete legacy.ticketReference;
    const upgraded = applyTransforms(legacy as WorkspaceExportData);
    expect(upgraded.version).toBe('1.21.0');
    expect(upgraded.ticketReference).toBeNull();
  });

  it('upgrades a 1.20 file giving each ticket the reference its number had in the file format', () => {
    const plain = { ...ticket('t-1', null), ticketNumber: 42 } as Partial<WorkspaceExportData['tickets'][number]>;
    delete plain.reference;
    const legacy = emptyExport({ version: '1.20.0', ticketReference: { style: 'sequential', prefix: 'SUP', secret: null }, tickets: [plain as WorkspaceExportData['tickets'][number]] });
    const upgraded = applyTransforms(legacy);
    expect(upgraded.version).toBe('1.21.0');
    expect(upgraded.tickets[0].reference).toBe('SUP-000042');

    const fresh = { ...ticket('t-1', null), ticketNumber: 42 } as Partial<WorkspaceExportData['tickets'][number]>;
    delete fresh.reference;
    const older = emptyExport({ version: '1.19.0', tickets: [fresh as WorkspaceExportData['tickets'][number]] }) as Partial<WorkspaceExportData>;
    delete older.ticketReference;
    expect(applyTransforms(older as WorkspaceExportData).tickets[0].reference).toBe('TK-000042');
  });

  it('exports the reference each ticket keeps, or the one the format gives a ticket stored without it', async () => {
    const qr = new FakeQueryRunner((sql) => {
      if (/FROM workspaces WHERE id/.test(sql)) return [{ name: 'Acme', description: '', slaPolicy: null, metadata: null }];
      if (/FROM workspace_ticket_references WHERE/.test(sql)) return [{ style: 'sequential', prefix: 'SUP', secret: null }];
      if (/FROM tickets t/.test(sql)) {
        return [
          { id: 't-1', ticketNumber: 1, reference: 'TK-000001', tagIds: [], createdAt: new Date(), updatedAt: new Date() },
          { id: 't-2', ticketNumber: 2, reference: null, tagIds: [], createdAt: new Date(), updatedAt: new Date() },
        ];
      }
      return [];
    });
    const result = await new ExportWorkspace(dataSourceOf(qr)).execute('ws-1');
    expect(result.tickets.map((t) => t.reference)).toEqual(['TK-000001', 'SUP-000002']);
  });

  it('keeps the source references and gives a new one, in the target format, to a reference already taken', async () => {
    const qr = new FakeQueryRunner((sql, params) => {
      if (/FROM users WHERE email = ANY/.test(sql)) return [{ id: 'u-1', email: 'alice@example.com' }];
      if (/MAX\("ticketNumber"\)/.test(sql)) return [{ max: 10 }];
      // The target already has ACME-000011 (a kept reference) and ACME-000012 (its own)
      if (/SELECT reference FROM tickets/.test(sql)) return [{ reference: 'ACME-000011' }, { reference: 'ACME-000012' }, { reference: 'OLD-7' }];
      if (/FROM workspace_ticket_references WHERE/.test(sql)) return [{ style: 'sequential', prefix: 'ACME', secret: null }];
      return answerFrom({})(sql, params);
    });
    const data = emptyExport({
      users: [{ email: 'alice@example.com', firstName: 'Alice', lastName: 'A', role: 'admin' }],
      tickets: [
        { ...ticket('t-1', null), ticketNumber: 1, reference: 'old-5' },
        { ...ticket('t-2', null), ticketNumber: 2, reference: 'OLD-7' },
        { ...ticket('t-3', null), ticketNumber: 3, reference: 'OLD-5' },
      ],
    });

    await new ImportWorkspace(dataSourceOf(qr)).execute('ws-target', data);

    const inserts = qr.find(/INSERT INTO tickets/);
    // [name, number, reference]: t-1 keeps its reference (upper case); t-2's is taken in the target,
    // so it gets the next free one in the target format, skipping 11 and 12; t-3's duplicates t-1's
    expect(inserts.map((q) => [q.params[1], q.params[9], q.params[28]])).toEqual([
      ['Ticket t-1', 11, 'OLD-5'],
      ['Ticket t-2', 13, 'ACME-000013'],
      ['Ticket t-3', 14, 'ACME-000014'],
    ]);
  });

  it('previews the format without its key', () => {
    expect(buildImportPreview(emptyExport({ ticketReference: { style: 'random', prefix: 'ACME', secret } })).settings.ticketReference)
      .toEqual({ style: 'random', prefix: 'ACME' });
  });

  it('leaves the target format alone unless overwritten', async () => {
    const { qr, result } = await run(emptyExport({ ticketReference: { style: 'random', prefix: 'ACME', secret } }));
    expect(qr.find(/workspace_ticket_references/)).toHaveLength(0);
    expect(result.settingsApplied).toEqual([]);
  });

  it('applies format, prefix and key when overwritten', async () => {
    const { qr, result } = await run(emptyExport({ ticketReference: { style: 'random', prefix: 'acme', secret } }), ['ticketReference']);
    const [upsert] = qr.find(/INSERT INTO workspace_ticket_references/);
    expect(upsert.sql).toMatch(/ON CONFLICT \("workspaceId"\) DO UPDATE SET/);
    expect(upsert.params).toEqual(['ws-target', 'random', 'ACME', secret]);
    expect(result.settingsApplied).toEqual(['ticketReference']);
  });

  it.each([
    [{ style: 'emoji' }, 'ticketReference.style'],
    [{ prefix: 'NOT VALID' }, 'ticketReference.prefix'],
    [{ secret: 'short' }, 'ticketReference.secret'],
    [{ secret: null }, 'ticketReference.secret'],
  ])('rejects a reference format %p before touching the database', async (patch, field) => {
    const data = emptyExport({ ticketReference: { style: 'random', prefix: 'ACME', secret, ...patch } as WorkspaceExportData['ticketReference'] });
    await expect(run(data, ['ticketReference'])).rejects.toThrow(field);
  });
});
