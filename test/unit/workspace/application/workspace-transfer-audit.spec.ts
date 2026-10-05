import { CreateAuditLogEntry } from '../../../../src/audit-log/domain/services/audit-log-create';
import { DomainValidationError } from '../../../../src/shared/domain/errors';
import {
  exportSummaryOf,
  importFailureReason,
  importSourceOf,
  WorkspaceTransferAudit,
} from '../../../../src/workspace/application/workspace-transfer-audit';
import type { ImportResult } from '../../../../src/workspace/domain/services/workspace-import';
import type { WorkspaceExportBundle } from '../../../../src/workspace/domain/services/workspace-export';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';
import { MockAuditLogRepository } from '../../../mocks/mock-audit-log.repository';

const isPrimitive = (value: unknown) => ['string', 'number', 'boolean'].includes(typeof value);

function emptyResult(overrides: Partial<ImportResult> = {}): ImportResult {
  return {
    usersCreated: 0, membersAdded: 0, organizationsImported: 0, departmentsImported: 0, tagsImported: 0, categoriesImported: 0,
    projectsImported: 0, ticketsImported: 0, ticketsAlreadyPresent: 0, ticketsCompleted: 0, commentsImported: 0, commentsSkipped: 0,
    descriptionEditsImported: 0, commentEditsImported: 0, attachmentsImported: 0, attachmentsSkipped: 0, attachmentsOfExistingTickets: 0,
    participantsImported: 0, cannedResponsesImported: 0, customFieldsImported: 0, csatResponsesImported: 0, kbCategoriesImported: 0,
    kbArticlesImported: 0, auditLogImported: 0, mailboxesImported: 0, emailRulesImported: 0, webhooksImported: 0,
    customDomainSkipped: null, credentialsIncluded: false, settingsApplied: [],
    ...overrides,
  };
}

const summary = (includeCredentials = false) => ({
  formatVersion: '1.17.0', includeCredentials, tickets: 3, attachments: 2, files: 3, filesBytes: 4096,
});

describe('WorkspaceTransferAudit', () => {
  let repository: MockAuditLogRepository;
  let audit: WorkspaceTransferAudit;

  beforeEach(() => {
    repository = new MockAuditLogRepository();
    audit = new WorkspaceTransferAudit(new CreateAuditLogEntry(new FakeIdGenerator(), repository));
  });

  const only = () => {
    expect(repository.entries).toHaveLength(1);
    const [entry] = repository.entries;
    expect(entry).toMatchObject({ entityType: 'workspace', entityId: 'ws-1', workspaceId: 'ws-1', category: 'workspace' });
    for (const value of Object.values(entry.metadata ?? {})) expect(isPrimitive(value)).toBe(true);
    return entry;
  };

  it('records a direct export with what the file carried, at info level without credentials', async () => {
    await audit.exported({ workspaceId: 'ws-1', userId: 'u-1', summary: summary(), completed: true });

    const entry = only();
    expect(entry.action).toBe('workspace-exported');
    expect(entry.userId).toBe('u-1');
    expect(entry.level).toBe('info');
    expect(entry.metadata).toEqual({
      formatVersion: '1.17.0', includeCredentials: false, tickets: 3, attachments: 2, files: 3, filesBytes: 4096, completed: true,
    });
  });

  it('records an export that carried credentials as a warning', async () => {
    await audit.exported({ workspaceId: 'ws-1', userId: 'u-1', summary: summary(true), completed: true });
    expect(only().level).toBe('warning');
  });

  it('records the creation of an export link with its expiry, a warning when it will carry credentials', async () => {
    const expiresAt = new Date('2026-10-05T10:00:00.000Z');
    await audit.exportLinkCreated({ workspaceId: 'ws-1', userId: 'u-1', formatVersion: '1.17.0', includeCredentials: true, expiresAt });

    const entry = only();
    expect(entry.action).toBe('workspace-export-created');
    expect(entry.level).toBe('warning');
    expect(entry.metadata).toEqual({ formatVersion: '1.17.0', includeCredentials: true, expiresAt: '2026-10-05T10:00:00.000Z' });
  });

  it('records the download of an export link with no user, only the requester address', async () => {
    const expiresAt = new Date('2026-10-05T10:00:00.000Z');
    await audit.exportLinkDownloaded({ workspaceId: 'ws-1', summary: summary(), completed: false, expiresAt, ip: '203.0.113.7' });

    const entry = only();
    expect(entry.action).toBe('workspace-export-link-downloaded');
    expect(entry.userId).toBeNull();
    expect(entry.level).toBe('info');
    expect(entry.metadata).toMatchObject({ ip: '203.0.113.7', expiresAt: '2026-10-05T10:00:00.000Z', completed: false, tickets: 3 });
  });

  it('records a completed import flat: the source, the options and every counter that is not zero', async () => {
    await audit.importCompleted({
      workspaceId: 'ws-1',
      userId: 'u-1',
      source: { source: 'file', fileName: 'acme-2026-10-01.ohd' },
      formatVersion: '1.16.0',
      completeExisting: true,
      overwrite: ['name', 'customDomain'],
      result: emptyResult({
        ticketsImported: 4, ticketsCompleted: 1, commentsImported: 9, mailboxesImported: 1,
        settingsApplied: ['name'], credentialsIncluded: true, customDomainSkipped: '"help.acme.com" is used by another workspace.',
      }),
      durationMs: 1234,
    });

    const entry = only();
    expect(entry.action).toBe('workspace-import-completed');
    expect(entry.level).toBe('info');
    expect(entry.metadata).toEqual({
      source: 'file',
      fileName: 'acme-2026-10-01.ohd',
      formatVersion: '1.16.0',
      completeExisting: true,
      overwrite: 'name,customDomain',
      ticketsImported: 4,
      ticketsCompleted: 1,
      commentsImported: 9,
      mailboxesImported: 1,
      settingsApplied: 'name',
      credentialsIncluded: true,
      customDomainSkipped: '"help.acme.com" is used by another workspace.',
      durationMs: 1234,
    });
  });

  it('records a failed import at error level with the reason the user was shown', async () => {
    await audit.importFailed({
      workspaceId: 'ws-1',
      userId: 'u-1',
      source: { source: 'url', urlHost: 'desk.example.com' },
      reason: importFailureReason(new DomainValidationError('Wrong password')),
      durationMs: 50,
    });

    const entry = only();
    expect(entry.action).toBe('workspace-import-failed');
    expect(entry.level).toBe('error');
    expect(entry.metadata).toEqual({ source: 'url', urlHost: 'desk.example.com', reason: 'Wrong password', durationMs: 50 });
  });
});

describe('importFailureReason', () => {
  it('keeps the message of a domain error and of a client HTTP error', () => {
    expect(importFailureReason(new DomainValidationError('Send an export file or a URL'))).toBe('Send an export file or a URL');
    const tooLarge = Object.assign(new Error('File too large'), { getStatus: () => 413 });
    expect(importFailureReason(tooLarge)).toBe('File too large');
  });

  it('hides anything else behind a generic message', () => {
    const generic = 'The import failed because of an unexpected error';
    expect(importFailureReason(new Error('duplicate key value violates unique constraint "PK_x" at /srv/app/dist/x.js:12'))).toBe(generic);
    expect(importFailureReason(Object.assign(new Error('boom'), { getStatus: () => 500 }))).toBe(generic);
    expect(importFailureReason('weird')).toBe(generic);
  });
});

describe('importSourceOf', () => {
  it('names the uploaded file, or only the host of a link, never its token', () => {
    expect(importSourceOf('acme.ohd', null)).toEqual({ source: 'file', fileName: 'acme.ohd' });
    expect(importSourceOf(undefined, 'https://desk.example.com:8443/workspaces/acme/export/abc123secret'))
      .toEqual({ source: 'url', urlHost: 'desk.example.com:8443' });
    expect(importSourceOf(null, '')).toEqual({ source: 'direct' });
  });
});

describe('exportSummaryOf', () => {
  it('counts tickets, carried attachments, archive files and their bytes', () => {
    const bundle = {
      data: { version: '1.17.0', tickets: [{}, {}], attachments: [{ file: 'files/a' }, { file: null }] },
      files: [{ path: 'files/a', storageKey: 'k1', size: 100 }, { path: 'files/l', storageKey: 'k2', size: 20 }],
    } as unknown as WorkspaceExportBundle;
    expect(exportSummaryOf(bundle, false)).toEqual({
      formatVersion: '1.17.0', includeCredentials: false, tickets: 2, attachments: 1, files: 2, filesBytes: 120,
    });
  });
});
