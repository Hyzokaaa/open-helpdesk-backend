import { Inject, Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UlidGenerator } from '../../../shared/infrastructure/ulid-generator';
import { NestEventPublisher } from '../../../shared/infrastructure/nest-event-publisher';
import { BcryptPasswordHasher } from '../../../shared/infrastructure/bcrypt-password-hasher';
import { TypeOrmMailboxRepository } from '../../../mailbox/infrastructure/typeorm/repositories/typeorm-mailbox.repository';
import { TypeOrmUserRepository } from '../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmWorkspaceRepository } from '../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmTicketRepository } from '../../../ticket/infrastructure/typeorm/repositories/typeorm-ticket.repository';
import { TypeOrmCommentRepository } from '../../../comment/infrastructure/typeorm/repositories/typeorm-comment.repository';
import { CreateUser } from '../../../user/domain/services/user-create';
import { AddWorkspaceMember } from '../../../workspace/domain/services/workspace-add-member';
import { CreateTicket } from '../../../ticket/domain/services/ticket-create';
import { CreateComment } from '../../../comment/domain/services/comment-create';
import { RouteInboundEmail } from '../../domain/services/route-inbound-email';
import { ImapEmailParser, ImapEnvelope } from './imap-email-parser';
import { ProcessedEmailRepository } from '../typeorm/repositories/processed-email.repository';

const MAX_BACKOFF = 60000;

@Injectable()
export class ImapPollingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImapPollingService.name);
  private stopping = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoff = 1000;
  private processing = false;
  private lastPollTime: Date | null = null;

  private readonly host?: string;
  private readonly port: number;
  private readonly user?: string;
  private readonly pass?: string;
  private readonly tls: boolean;
  private readonly folder: string;
  private readonly pollInterval: number;
  private readonly emailDomain?: string;

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
    private readonly config: ConfigService,
  ) {
    this.host = config.get<string>('IMAP_HOST');
    this.port = config.get<number>('IMAP_PORT', 993);
    this.user = config.get<string>('IMAP_USER');
    this.pass = config.get<string>('IMAP_PASS');
    this.tls = config.get<string>('IMAP_TLS', 'true') === 'true';
    this.folder = config.get<string>('IMAP_FOLDER', 'INBOX');
    this.pollInterval = config.get<number>('IMAP_POLL_INTERVAL', 30);
    this.emailDomain = config.get<string>('EMAIL_DOMAIN');
  }

  onModuleInit() {
    if (!this.host || !this.user || !this.pass) {
      this.logger.log('IMAP not configured — skipping email polling');
      return;
    }

    if (!this.emailDomain) {
      this.logger.warn('IMAP configured but EMAIL_DOMAIN not set — skipping');
      return;
    }

    this.logger.log(`IMAP polling enabled: ${this.user}@${this.host} every ${this.pollInterval}s`);
    this.poll();
  }

  onModuleDestroy() {
    this.stopping = true;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
  }

  private scheduleNext() {
    if (this.stopping) return;
    this.pollTimer = setTimeout(() => this.poll(), this.pollInterval * 1000);
  }

  private scheduleReconnect() {
    if (this.stopping) return;
    this.logger.warn(`IMAP reconnecting in ${this.backoff / 1000}s...`);
    this.reconnectTimer = setTimeout(() => this.poll(), this.backoff);
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF);
  }

  private async poll() {
    if (this.stopping || this.processing) return;
    this.processing = true;

    try {
      // Phase 1: Fetch — connect, grab new messages since last poll, disconnect
      const fetched = await this.fetchNewMessages();

      // Phase 2: Process — offline, no IMAP connection needed
      if (fetched.length > 0) {
        const parser = new ImapEmailParser(this.emailDomain!);
        const router = this.createRouter();
        let count = 0;

        for (const msg of fetched) {
          const wasProcessed = await this.processMessage(msg, parser, router);
          if (wasProcessed) count++;
        }

        if (count > 0) {
          this.logger.log(`IMAP: processed ${count} email(s)`);
        }
      }

      this.backoff = 1000;
      this.scheduleNext();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`IMAP poll failed: ${errMsg}`);
      this.scheduleReconnect();
    } finally {
      this.processing = false;
    }
  }

  private async fetchNewMessages(): Promise<FetchedMessage[]> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ImapFlow } = require('imapflow');

    const client = new ImapFlow({
      host: this.host!,
      port: this.port,
      secure: this.tls,
      auth: { user: this.user!, pass: this.pass! },
      logger: false,
    });

    client.on('error', () => {});

    const results: FetchedMessage[] = [];
    const since = this.lastPollTime ?? new Date();

    try {
      await client.connect();

      const lock = await client.getMailboxLock(this.folder);
      try {
        const messages = client.fetch({ since }, {
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
      try { await client.logout(); } catch { /* already disconnected */ }
    }

    this.lastPollTime = new Date();
    return results;
  }

  private async processMessage(msg: FetchedMessage, parser: ImapEmailParser, router: RouteInboundEmail): Promise<boolean> {
    try {
      // Idempotency: skip already processed emails
      if (msg.envelope.messageId) {
        const alreadyProcessed = await this.processedEmailRepository.exists(msg.envelope.messageId);
        if (alreadyProcessed) return false;
      }

      const textBody = this.extractTextFromMime(msg.body);
      const parsed = parser.parse(msg.envelope, textBody);

      this.logger.log(`IMAP: processing email from ${parsed.fromAddress} — subject: ${parsed.subject}`);

      const result = await router.execute(parsed);
      this.logger.log(`IMAP: routed ${result.action}${result.ticketId ? ` (ticket: ${result.ticketId})` : ''}`);

      if (msg.envelope.messageId) {
        await this.processedEmailRepository.markProcessed(msg.envelope.messageId);
      }

      return true;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`IMAP: failed to process message UID ${msg.uid}: ${errMsg}`);
      return false;
    }
  }

  private mapEnvelope(envelope: any): ImapEnvelope {
    const from = envelope.from?.[0]?.address ?? '';
    const to = (envelope.to ?? []).map((a: any) => a.address ?? '');
    return {
      from,
      to,
      subject: envelope.subject ?? '',
      messageId: envelope.messageId ?? '',
      inReplyTo: envelope.inReplyTo ?? undefined,
    };
  }

  private extractTextFromMime(raw: string): string {
    const headerEnd = raw.indexOf('\r\n\r\n');
    if (headerEnd === -1) return raw;

    const body = raw.substring(headerEnd + 4);
    const contentType = raw.substring(0, headerEnd);
    const boundaryMatch = contentType.match(/boundary="?([^"\r\n]+)"?/i);

    if (!boundaryMatch) {
      return this.decodeQuotedPrintable(body);
    }

    const boundary = boundaryMatch[1];
    const parts = body.split(`--${boundary}`);

    for (const part of parts) {
      if (part.match(/content-type:\s*text\/plain/i)) {
        const partHeaderEnd = part.indexOf('\r\n\r\n');
        if (partHeaderEnd !== -1) {
          return this.decodeQuotedPrintable(part.substring(partHeaderEnd + 4));
        }
      }
    }

    for (const part of parts) {
      if (part.match(/content-type:\s*text\/html/i)) {
        const partHeaderEnd = part.indexOf('\r\n\r\n');
        if (partHeaderEnd !== -1) {
          return this.decodeQuotedPrintable(part.substring(partHeaderEnd + 4));
        }
      }
    }

    return body;
  }

  private decodeQuotedPrintable(text: string): string {
    return text
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  private createRouter(): RouteInboundEmail {
    const createUser = new CreateUser(this.idGenerator, this.userRepository, this.passwordHasher);
    const addMember = new AddWorkspaceMember(this.idGenerator, this.memberRepository);
    const createTicket = new CreateTicket(this.idGenerator, this.ticketRepository);
    const createComment = new CreateComment(this.idGenerator, this.commentRepository);

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
    );
  }
}

interface FetchedMessage {
  uid: number;
  envelope: ImapEnvelope;
  body: string;
}
