import { ImapPollingService } from '../../../src/email-inbound/infrastructure/imap/imap-polling.service';
import { FakeIdGenerator } from '../../mocks/fake-id-generator';
import { MockAuditLogRepository } from '../../mocks/mock-audit-log.repository';

/** The processed-email marks as the real repository keeps them: per mailbox, with '*' standing for all */
class InMemoryProcessedEmails {
  readonly marks = new Set<string>();
  async exists(messageId: string, mailboxId: string) {
    return this.marks.has(`${messageId}|${mailboxId}`) || this.marks.has(`${messageId}|*`);
  }
  async markProcessed(messageId: string, mailboxId: string) {
    this.marks.add(`${messageId}|${mailboxId}`);
  }
}

const mailbox = (id: string, address: string) => ({
  getId: () => id, address, addressMode: 'address', acceptedAddresses: [], workspaceId: 'ws-1',
});

// Two mailboxes on one shared inbox, each for its own address (ventas@ and soporte@)
describe('Two mailboxes reading the same inbox', () => {
  let processed: InMemoryProcessedEmails;
  let routed: string[];
  let service: any;

  const message = { uid: 1, envelope: { messageId: '<m1@x.com>', subject: 'Help', from: 'c@x.com' }, body: '' };
  const parser = { parse: async () => ({ toAddresses: ['soporte@x.com'], fromAddress: 'c@x.com', subject: 'Help' }) };
  const router = (mailboxId: string) => ({ execute: async () => { routed.push(mailboxId); return { action: 'ticket-created', ticketId: 't-1' }; } });
  const handle = (box: ReturnType<typeof mailbox>) =>
    service.processMessage(message, parser, router(box.getId()), box.getId(), box.workspaceId, box);

  beforeEach(() => {
    processed = new InMemoryProcessedEmails();
    routed = [];
    service = new ImapPollingService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, new FakeIdGenerator() as any, {} as any, {} as any,
      processed as any, {} as any, {} as any, new MockAuditLogRepository() as any, {} as any, {} as any, {} as any,
    );
  });

  it('lets the mailbox the message is for take it, even after the other one skipped it', async () => {
    expect(await handle(mailbox('ventas', 'ventas@x.com'))).toBe('skipped');
    expect(await handle(mailbox('soporte', 'soporte@x.com'))).toBe('created');
    expect(routed).toEqual(['soporte']);
  });

  it('still takes each message once per mailbox', async () => {
    await handle(mailbox('soporte', 'soporte@x.com'));
    expect(await handle(mailbox('soporte', 'soporte@x.com'))).toBe('skipped');
    expect(routed).toEqual(['soporte']);
  });

  it('treats a message marked before mailboxes kept their own marks as already taken by all', async () => {
    processed.marks.add('<m1@x.com>|*');
    expect(await handle(mailbox('soporte', 'soporte@x.com'))).toBe('skipped');
    expect(routed).toEqual([]);
  });
});
