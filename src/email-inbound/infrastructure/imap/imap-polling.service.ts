import { Inject, Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { UlidGenerator } from '../../../shared/infrastructure/ulid-generator';
import { NestEventPublisher } from '../../../shared/infrastructure/nest-event-publisher';
import { BcryptPasswordHasher } from '../../../shared/infrastructure/bcrypt-password-hasher';
import { TypeOrmMailboxRepository } from '../../../mailbox/infrastructure/typeorm/repositories/typeorm-mailbox.repository';
import { TypeOrmUserRepository } from '../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmWorkspaceRepository } from '../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmTicketRepository } from '../../../ticket/infrastructure/typeorm/repositories/typeorm-ticket.repository';
import { TypeOrmCommentRepository } from '../../../comment/infrastructure/typeorm/repositories/typeorm-comment.repository';
import { TypeOrmAuditLogRepository } from '../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';
import { CreateUser } from '../../../user/domain/services/user-create';
import { AddWorkspaceMember } from '../../../workspace/domain/services/workspace-add-member';
import { CreateTicket } from '../../../ticket/domain/services/ticket-create';
import { CreateComment } from '../../../comment/domain/services/comment-create';
import { RouteInboundEmail } from '../../domain/services/route-inbound-email';
import { CreateAttachment } from '../../../attachment/domain/services/attachment-create';
import { TypeOrmAttachmentRepository } from '../../../attachment/infrastructure/typeorm/repositories/typeorm-attachment.repository';
import { StorageService } from '../../../shared/domain/storage-service';
import { STORAGE_SERVICE } from '../../../shared/shared.module';
import { MailboxType } from '../../../mailbox/domain/enums/mailbox-type.enum';
import { Mailbox } from '../../../mailbox/domain/entities/mailbox';
import { ImapEmailParser, ImapEnvelope } from './imap-email-parser';
import { ProcessedEmailRepository } from '../typeorm/repositories/processed-email.repository';
import { TypeOrmEmailRuleRepository } from '../../../email-rule/infrastructure/typeorm/repositories/typeorm-email-rule.repository';
import { EvaluateEmailRules } from '../../../email-rule/domain/services/email-rule-evaluate';

const REFRESH_INTERVAL = 60000;

interface PollerState {
  mailboxId: string;
  configHash: string;
  timer: ReturnType<typeof setTimeout> | null;
  processing: boolean;
  backoff: number;
  lastPollTime: Date | null;
}

@Injectable()
export class ImapPollingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImapPollingService.name);
  private pollers = new Map<string, PollerState>();
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private stopping = false;

  constructor(
    @Inject() private readonly mailboxRepository: TypeOrmMailboxRepository,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly ticketRepository: TypeOrmTicketRepository,
    @Inject() private readonly commentRepository: TypeOrmCommentRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly passwordHasher: BcryptPasswordHasher,
    @Inject() private readonly eventPublisher: NestEventPublisher,
    @Inject() private readonly processedEmailRepository: ProcessedEmailRepository,
    @Inject() private readonly attachmentRepository: TypeOrmAttachmentRepository,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
    @Inject() private readonly emailRuleRepository: TypeOrmEmailRuleRepository,
  ) {}

  async onModuleInit() {
    await this.refreshPollers();
    this.refreshTimer = setInterval(() => this.refreshPollers(), REFRESH_INTERVAL);
  }

  async importMailbox(mailboxId: string, since: Date | null): Promise<{ processed: number; rejected: number; total: number }> {
    const mailbox = await this.mailboxRepository.findById(mailboxId);
    if (!mailbox || !mailbox.imapHost || !mailbox.imapUser || !mailbox.imapPass) {
      throw new Error('Mailbox not found or IMAP not configured');
    }

    const fetched = await this.fetchMessages({
      host: mailbox.imapHost,
      port: mailbox.imapPort ?? 993,
      user: mailbox.imapUser,
      pass: mailbox.imapPass,
      tls: mailbox.imapTls ?? true,
      encryption: mailbox.encryption,
      folder: mailbox.imapFolder ?? 'INBOX',
      since,
    });

    const parser = new ImapEmailParser();
    const router = this.createRouter();
    let processed = 0;
    let rejected = 0;

    for (const msg of fetched) {
      const result = await this.processMessage(msg, parser, router, mailbox.getId(), mailbox.workspaceId, mailbox);
      if (result === 'created') processed++;
      else if (result === 'rejected') rejected++;
    }

    this.logger.log(`IMAP import [${mailbox.address}]: processed ${processed}, rejected ${rejected}, total ${fetched.length}`);
    return { processed, rejected, total: fetched.length };
  }

  async refreshNow(): Promise<void> {
    await this.refreshPollers();
  }

  stopPoller(mailboxId: string): void {
    const state = this.pollers.get(mailboxId);
    if (state) {
      if (state.timer) clearTimeout(state.timer);
      this.pollers.delete(mailboxId);
      this.logger.log(`IMAP poller stopped immediately: ${mailboxId}`);
    }
  }

  @OnEvent('mailbox.deleted')
  handleMailboxDeleted(event: { mailboxId: string }): void {
    this.stopPoller(event.mailboxId);
  }

  onModuleDestroy() {
    this.stopping = true;
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    for (const [, state] of this.pollers) {
      if (state.timer) clearTimeout(state.timer);
    }
    this.pollers.clear();
  }

  private async refreshPollers() {
    if (this.stopping) return;

    // Load IMAP mailboxes from DB
    const dbMailboxes = await this.mailboxRepository.findAllByType(MailboxType.IMAP);

    // Build active set
    const activeIds = new Set<string>();

    for (const mailbox of dbMailboxes) {
      activeIds.add(mailbox.getId());
      const hash = this.configHash(mailbox);
      const existing = this.pollers.get(mailbox.getId());

      if (existing && existing.configHash === hash) continue;

      // New or changed — stop old, start new
      if (existing?.timer) clearTimeout(existing.timer);

      const state: PollerState = {
        mailboxId: mailbox.getId(),
        configHash: hash,
        timer: null,
        processing: false,
        backoff: 1000,
        lastPollTime: null,
      };
      this.pollers.set(mailbox.getId(), state);
      this.logger.log(`IMAP poller started: ${mailbox.address} (${mailbox.imapUser}@${mailbox.imapHost})`);
      this.pollMailbox(mailbox, state);
    }

    // Stop pollers for removed mailboxes
    for (const [id, state] of this.pollers) {
      if (!activeIds.has(id)) {
        if (state.timer) clearTimeout(state.timer);
        this.pollers.delete(id);
        this.logger.log(`IMAP poller stopped: ${id}`);
      }
    }
  }

  private async pollMailbox(mailbox: Mailbox, state: PollerState) {
    if (this.stopping || state.processing || !this.pollers.has(mailbox.getId())) return;
    state.processing = true;
    const pollStart = Date.now();

    try {
      this.emitAudit(AuditAction.IMAP_POLL_STARTED, mailbox.getId(), mailbox.workspaceId, { address: mailbox.address }).catch(() => {});

      const fetched = await this.fetchMessages({
        host: mailbox.imapHost!,
        port: mailbox.imapPort!,
        user: mailbox.imapUser!,
        pass: mailbox.imapPass!,
        tls: mailbox.imapTls ?? true,
        encryption: mailbox.encryption,
        folder: mailbox.imapFolder ?? 'INBOX',
        since: state.lastPollTime,
      });

      state.lastPollTime = new Date();

      if (fetched.length > 0) {
        const parser = new ImapEmailParser();
        const router = this.createRouter();
        let count = 0;

        for (const msg of fetched) {
          const result = await this.processMessage(msg, parser, router, mailbox.getId(), mailbox.workspaceId, mailbox);
          if (result === 'created') count++;
        }

        if (count > 0) this.logger.log(`IMAP [${mailbox.address}]: processed ${count} email(s)`);
      }

      // Mark success
      mailbox.lastSyncAt = new Date();
      mailbox.lastSyncDuration = Date.now() - pollStart;
      mailbox.lastError = null;
      await this.mailboxRepository.update(mailbox);

      this.emitAudit(AuditAction.IMAP_POLL_COMPLETED, mailbox.getId(), mailbox.workspaceId, { address: mailbox.address, fetched: fetched.length, duration: Date.now() - pollStart }).catch(() => {});

      state.backoff = 1000;
      if (this.pollers.has(mailbox.getId())) {
        state.timer = setTimeout(() => this.pollMailbox(mailbox, state), (mailbox.pollInterval ?? 30) * 1000);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`IMAP [${mailbox.address}] poll failed: ${errMsg}`);

      this.emitAudit(AuditAction.IMAP_POLL_FAILED, mailbox.getId(), mailbox.workspaceId, { address: mailbox.address, error: errMsg }, AuditLevel.ERROR).catch(() => {});

      // Mark error
      mailbox.lastError = errMsg;
      try { await this.mailboxRepository.update(mailbox); } catch (e) {
        this.logger.warn(`Failed to persist mailbox error state for ${mailbox.address}: ${e instanceof Error ? e.message : e}`);
      }

      if (this.pollers.has(mailbox.getId())) {
        state.timer = setTimeout(() => this.pollMailbox(mailbox, state), state.backoff);
        state.backoff = Math.min(state.backoff * 2, 60000);
      }
    } finally {
      state.processing = false;
    }
  }

  private async fetchMessages(config: ImapConfig): Promise<FetchedMessage[]> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ImapFlow } = require('imapflow');

    const encryption = config.encryption ?? (config.tls ? 'tls' : 'none');
    const secure = encryption === 'tls' || encryption === 'tls-insecure';
    const tlsOptions = encryption === 'tls-insecure' ? { rejectUnauthorized: false } : undefined;

    const client = new ImapFlow({
      host: config.host,
      port: config.port,
      secure,
      ...(tlsOptions && { tls: tlsOptions }),
      auth: { user: config.user, pass: config.pass },
      logger: false,
    });

    client.on('error', (err: Error) => {
      this.logger.error(`IMAP client error for ${config.user}@${config.host}: ${err.message}`, err.stack);
    });

    const results: FetchedMessage[] = [];

    try {
      await client.connect();

      const lock = await client.getMailboxLock(config.folder);
      try {
        const status = await client.status(config.folder, { messages: true });
        if (status.messages === 0) {
          return results;
        }

        const query = config.since ? { since: config.since } : { all: true };
        const messages = client.fetch(query, {
          envelope: true,
          source: true,
          uid: true,
        });

        for await (const msg of messages) {
          results.push({
            uid: msg.uid,
            envelope: this.mapEnvelope(msg.envelope),
            body: msg.source?.toString('utf-8') ?? '',
          });
        }
      } finally {
        lock.release();
      }
    } finally {
      try { await client.logout(); } catch (e) {
        this.logger.debug(`IMAP logout failed for ${config.user}@${config.host}: ${e instanceof Error ? e.message : e}`);
      }
    }

    return results;
  }

  private async processMessage(msg: FetchedMessage, parser: ImapEmailParser, router: RouteInboundEmail, mailboxId?: string, workspaceId?: string | null, mailbox?: Mailbox): Promise<'created' | 'rejected' | 'skipped'> {
    try {
      if (msg.envelope.messageId) {
        const alreadyProcessed = await this.processedEmailRepository.exists(msg.envelope.messageId);
        if (alreadyProcessed) return 'skipped';
      }

      const parsed = await parser.parse(msg.envelope, msg.body);
      if (mailboxId) parsed.mailboxId = mailboxId;

      // Address filtering based on mode
      if (mailbox && mailbox.addressMode !== 'all') {
        const recipients = parsed.toAddresses.map(a => a.toLowerCase());
        let accepted: string[];

        if (mailbox.addressMode === 'aliases') {
          accepted = [mailbox.address.toLowerCase(), ...mailbox.acceptedAddresses.map(a => a.toLowerCase())];
        } else {
          // 'address' mode (default): only the main mailbox address
          accepted = [mailbox.address.toLowerCase()];
        }

        const matches = recipients.some(r => accepted.includes(r));

        if (!matches) {
          if (msg.envelope.messageId) {
            await this.processedEmailRepository.markProcessed(msg.envelope.messageId);
          }
          return 'skipped';
        }
      }

      this.logger.log(`IMAP: processing email from ${parsed.fromAddress} — subject: ${parsed.subject}`);

      const result = await router.execute(parsed);
      this.logger.log(`IMAP: routed ${result.action}${result.ticketId ? ` (ticket: ${result.ticketId})` : ''}`);

      if (msg.envelope.messageId) {
        await this.processedEmailRepository.markProcessed(msg.envelope.messageId);
      }

      if (mailboxId) {
        this.emitAudit(AuditAction.EMAIL_RECEIVED, mailboxId, workspaceId ?? null, { from: parsed.fromAddress, subject: parsed.subject, action: result.action, ticketId: result.ticketId ?? null }).catch(() => {});
      }

      return result.action === 'rejected' ? 'rejected' : 'created';
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`IMAP: failed to process message UID ${msg.uid}: ${errMsg}`);
      return 'skipped';
    }
  }

  private configHash(mailbox: Mailbox): string {
    return `${mailbox.imapHost}:${mailbox.imapPort}:${mailbox.imapUser}:${mailbox.imapTls}:${mailbox.encryption}:${mailbox.imapFolder}:${mailbox.pollInterval}:${mailbox.isActive}:${mailbox.addressMode}:${JSON.stringify(mailbox.acceptedAddresses)}`;
  }

  private mapEnvelope(envelope: any): ImapEnvelope {
    const from = envelope.from?.[0]?.address ?? '';
    const fromName = envelope.from?.[0]?.name ?? undefined;
    const to = (envelope.to ?? []).map((a: any) => a.address ?? '');
    const cc = (envelope.cc ?? []).map((a: any) => a.address ?? '');
    const date = envelope.date ? new Date(envelope.date) : undefined;
    return {
      from,
      fromName,
      to,
      cc,
      subject: envelope.subject ?? '',
      messageId: envelope.messageId ?? '',
      inReplyTo: envelope.inReplyTo ?? undefined,
      date: date && !isNaN(date.getTime()) ? date : undefined,
    };
  }

  private extractTextFromMime(raw: string): string {
    const headerEnd = raw.indexOf('\r\n\r\n');
    if (headerEnd === -1) return raw;

    const body = raw.substring(headerEnd + 4);
    const contentType = raw.substring(0, headerEnd);
    const boundaryMatch = contentType.match(/boundary="?([^"\r\n]+)"?/i);

    if (!boundaryMatch) return this.decodeQuotedPrintable(body);

    const boundary = boundaryMatch[1];
    const parts = body.split(`--${boundary}`);

    for (const part of parts) {
      if (part.match(/content-type:\s*text\/plain/i)) {
        const ph = part.indexOf('\r\n\r\n');
        if (ph !== -1) return this.decodeQuotedPrintable(part.substring(ph + 4));
      }
    }

    for (const part of parts) {
      if (part.match(/content-type:\s*text\/html/i)) {
        const ph = part.indexOf('\r\n\r\n');
        if (ph !== -1) return this.decodeQuotedPrintable(part.substring(ph + 4));
      }
    }

    return body;
  }

  private decodeQuotedPrintable(text: string): string {
    return text
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  private async emitAudit(action: AuditAction, mailboxId: string, workspaceId: string | null, metadata: Record<string, unknown>, level: AuditLevel = AuditLevel.INFO): Promise<void> {
    try {
      const service = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
      await service.execute({
        action,
        entityType: 'mailbox',
        entityId: mailboxId,
        userId: null,
        workspaceId: workspaceId ?? null,
        metadata,
        category: AuditCategory.EMAIL,
        level,
        source: 'system',
      });
    } catch {
      // fire-and-forget: never break polling loop
    }
  }

  private createRouter(): RouteInboundEmail {
    const createUser = new CreateUser(this.idGenerator, this.userRepository, this.passwordHasher);
    const addMember = new AddWorkspaceMember(this.idGenerator, this.memberRepository);
    const createTicket = new CreateTicket(this.idGenerator, this.ticketRepository);
    const createComment = new CreateComment(this.idGenerator, this.commentRepository);
    const createAttachment = new CreateAttachment(this.idGenerator, this.attachmentRepository, this.storage);
    const evaluateRules = new EvaluateEmailRules(this.emailRuleRepository);

    return new RouteInboundEmail(
      this.mailboxRepository,
      this.userRepository,
      this.memberRepository,
      this.workspaceRepository,
      this.ticketRepository,
      createUser,
      addMember,
      createTicket,
      createComment,
      this.eventPublisher,
      createAttachment,
      evaluateRules,
    );
  }
}

interface ImapConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  tls: boolean;
  encryption?: string;
  folder: string;
  since: Date | null;
}

interface FetchedMessage {
  uid: number;
  envelope: ImapEnvelope;
  body: string;
}
