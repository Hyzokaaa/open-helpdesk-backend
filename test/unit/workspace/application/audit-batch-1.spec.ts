import { DeleteWorkspaceCommand } from '../../../../src/workspace/application/commands/delete-workspace.command';
import { DeleteWorkspace } from '../../../../src/workspace/domain/services/workspace-delete';
import { EnsureWorkspaceOwner } from '../../../../src/workspace/domain/services/workspace-ensure-owner';
import { MockAccountRepository } from '../../../mocks/mock-account.repository';
import { Workspace } from '../../../../src/workspace/domain/entities/workspace';
import { CreateAuditLogEntry } from '../../../../src/audit-log/domain/services/audit-log-create';
import { RecordAutoCreated } from '../../../../src/audit-log/domain/services/audit-log-record-auto-created';
import { AuditAction } from '../../../../src/audit-log/domain/enums/audit-action.enum';
import { AuditLevel } from '../../../../src/audit-log/domain/enums/audit-level.enum';
import { markImported, IMPORTED_AUDIT_SOURCE } from '../../../../src/workspace/domain/services/workspace-import';
import { webhookUrlHost } from '../../../../src/webhook/domain/webhook-url-host';
import { AccessDeniedError } from '../../../../src/shared/domain/errors';
import { MockWorkspaceRepository } from '../../../mocks/mock-workspace.repository';
import { MockAuditLogRepository } from '../../../mocks/mock-audit-log.repository';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';

describe('Audit log, batch 1', () => {
  let auditRepository: MockAuditLogRepository;
  let createEntry: CreateAuditLogEntry;

  beforeEach(() => {
    auditRepository = new MockAuditLogRepository();
    createEntry = new CreateAuditLogEntry(new FakeIdGenerator(), auditRepository);
  });

  describe('workspace deletion', () => {
    let workspaces: MockWorkspaceRepository;

    beforeEach(() => {
      workspaces = new MockWorkspaceRepository();
      workspaces.seed(new Workspace({ id: 'ws-1', name: 'Acme', slug: 'acme', description: '' }));
    });

    it('records nothing when the deletion is refused', async () => {
      const command = new DeleteWorkspaceCommand(new DeleteWorkspace(workspaces, new EnsureWorkspaceOwner(new MockAccountRepository())), createEntry);

      await expect(command.execute({ workspaceId: 'ws-1', isSystemAdmin: false, userId: 'u-1', confirmName: 'Acme' }))
        .rejects.toThrow(AccessDeniedError);
      expect(auditRepository.entries).toHaveLength(0);
    });

    it('keeps the name, slug and contents of the deleted workspace, as a warning', async () => {
      const command = new DeleteWorkspaceCommand(new DeleteWorkspace(workspaces, new EnsureWorkspaceOwner(new MockAccountRepository())), createEntry);

      await command.execute({ workspaceId: 'ws-1', isSystemAdmin: true, userId: 'u-1', confirmName: 'Acme', stats: { memberCount: 3, ticketCount: 12 } });

      const [entry] = auditRepository.entries;
      expect(entry.action).toBe(AuditAction.WORKSPACE_DELETED);
      expect(entry.level).toBe(AuditLevel.WARNING);
      // Kept on the entry: without a foreign key it survives the purge
      expect(entry.workspaceId).toBe('ws-1');
      expect(entry.metadata).toMatchObject({ workspaceId: 'ws-1', name: 'Acme', slug: 'acme', memberCount: 3, ticketCount: 12 });
      expect(typeof entry.metadata?.purgeAt).toBe('string');
    });
  });

  describe('accounts and memberships created as a side effect', () => {
    it('records the account and the membership, marked with how they came to be', async () => {
      await new RecordAutoCreated(createEntry).execute({
        via: 'inbound-email',
        user: { id: 'u-9', email: 'customer@example.com' },
        userCreated: true,
        member: { id: 'm-9', role: 'user' },
        workspaceId: 'ws-1',
        actorUserId: null,
        source: 'email',
      });

      expect(auditRepository.entries.map((e) => e.action)).toEqual([AuditAction.USER_CREATED, AuditAction.MEMBER_ADDED]);
      expect(auditRepository.entries[0].metadata).toEqual({ email: 'customer@example.com', autoCreated: true, via: 'inbound-email' });
      expect(auditRepository.entries[1].entityId).toBe('m-9');
      expect(auditRepository.entries.every((e) => e.source === 'email' && e.workspaceId === 'ws-1')).toBe(true);
    });

    it('records only the membership for an account that already existed', async () => {
      await new RecordAutoCreated(createEntry).execute({
        via: 'portal',
        user: { id: 'u-1', email: 'known@example.com' },
        userCreated: false,
        member: { id: 'm-1', role: 'user' },
        workspaceId: 'ws-1',
        actorUserId: null,
        source: 'portal',
      });

      expect(auditRepository.entries.map((e) => e.action)).toEqual([AuditAction.MEMBER_ADDED]);
    });
  });

  describe('imported history', () => {
    it('marks an imported row with when, from where, and the source it claimed', () => {
      const marked = markImported({ ticketName: 'Printer' }, 'ui', '2026-10-07T10:00:00.000Z', 'Acme');

      expect(marked).toEqual({
        ticketName: 'Printer',
        imported: { at: '2026-10-07T10:00:00.000Z', fromWorkspace: 'Acme', originalSource: 'ui' },
      });
      expect(IMPORTED_AUDIT_SOURCE).toBe('import');
    });

    it('keeps the mark of the first import when a row travels again', () => {
      const first = markImported(null, 'api', '2026-01-01T00:00:00.000Z', 'Origin');
      const again = markImported(first, IMPORTED_AUDIT_SOURCE, '2026-10-07T10:00:00.000Z', 'Middle');

      expect(again.imported).toEqual({ at: '2026-01-01T00:00:00.000Z', fromWorkspace: 'Origin', originalSource: 'api' });
    });
  });

  describe('webhook URLs in the audit log', () => {
    it('keeps only the host, since some URLs carry their secret in the path', () => {
      expect(webhookUrlHost('https://hooks.slack.com/services/T000/B000/XXXXSECRET')).toBe('hooks.slack.com');
      expect(webhookUrlHost('https://example.com:8443/hook?token=abc')).toBe('example.com:8443');
    });

    it('gives nothing for a missing or unparseable URL', () => {
      expect(webhookUrlHost(undefined)).toBeNull();
      expect(webhookUrlHost('not a url')).toBeNull();
    });
  });
});
