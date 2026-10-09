import { RecordEmailSend } from '../../../src/audit-log/domain/services/audit-log-record-email-send';
import { AuditAction } from '../../../src/audit-log/domain/enums/audit-action.enum';
import { AuditLevel } from '../../../src/audit-log/domain/enums/audit-level.enum';
import { MockAuditLogRepository } from '../../mocks/mock-audit-log.repository';
import { FakeIdGenerator } from '../../mocks/fake-id-generator';

describe('Recording an email send', () => {
  let repository: MockAuditLogRepository;
  const record = (result: Parameters<RecordEmailSend['execute']>[0]['result'], extra: Record<string, unknown> = {}) =>
    new RecordEmailSend(new FakeIdGenerator(), repository).execute({
      result, type: 'ticket-notification', to: 'a@x.com', subject: 'New ticket', workspaceId: 'ws-1', ticketId: 't-1', ...extra,
    });

  beforeEach(() => {
    repository = new MockAuditLogRepository();
  });

  it('records a sent email with who it went to, what it was and which server sent it', async () => {
    await record({ success: true, via: 'workspace' });
    const entry = repository.entries[0];
    expect(entry.action).toBe(AuditAction.EMAIL_SENT);
    expect(entry.level).toBe(AuditLevel.INFO);
    expect(entry.metadata).toEqual({ type: 'ticket-notification', to: ['a@x.com'], subject: 'New ticket', ticketId: 't-1', via: 'workspace' });
  });

  it('records a failed send as an error with the server answer', async () => {
    await record({ success: false, via: 'global', error: 'Invalid login: 535', errorCode: 'auth-failed' });
    const entry = repository.entries[0];
    expect(entry.action).toBe(AuditAction.EMAIL_SEND_FAILED);
    expect(entry.level).toBe(AuditLevel.ERROR);
    expect(entry.metadata).toMatchObject({ reason: 'send-failed', error: 'Invalid login: 535', errorCode: 'auth-failed', via: 'global' });
  });

  it('records a simulated send, without any mail server, as not sent', async () => {
    await record({ success: true, mock: true, via: 'global' });
    const entry = repository.entries[0];
    expect(entry.action).toBe(AuditAction.EMAIL_SEND_FAILED);
    expect(entry.level).toBe(AuditLevel.WARNING);
    expect(entry.metadata).toMatchObject({ reason: 'no-email-service' });
    expect(entry.metadata).not.toHaveProperty('via');
  });

  it('files an email about another record under that record and its actor', async () => {
    await record({ success: true }, { ticketId: null, entityType: 'invitation', entityId: 'inv-1', userId: 'u-1', source: 'ui' });
    const entry = repository.entries[0];
    expect([entry.entityType, entry.entityId, entry.userId, entry.source]).toEqual(['invitation', 'inv-1', 'u-1', 'ui']);
  });

  it('never fails the send when the audit write fails', async () => {
    repository.create = async () => { throw new Error('database down'); };
    await expect(record({ success: true })).resolves.toBeUndefined();
  });
});
