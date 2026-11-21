import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { EnvSecretCipher } from '../../../../shared/infrastructure/aes-secret-cipher';
import { WorkspaceFrontendResolver } from '../../../../shared/infrastructure/workspace-frontend-resolver';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { TypeOrmTicketRepository } from '../../../../ticket/infrastructure/typeorm/repositories/typeorm-ticket.repository';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { MATRIX_STANDALONE_NOTICE_EVENT, MATRIX_PERSONAL_NOTICE_EVENT, MatrixStandaloneNoticeEvent, MatrixPersonalNoticeEvent } from '../../../../notification/domain/matrix-personal-notice';
import { MatrixNoticeThrottle } from '../../../domain/matrix-notice-throttle';
import { MatrixDirectNotified, NotifyMatrixDirect } from '../../../domain/services/matrix-direct-notify';
import { NotifyMatrixStandalone } from '../../../domain/services/matrix-standalone-notify';
import { SendMatrixDirectSkipped } from '../../../domain/services/matrix-direct-skipped-send';
import { OpenMatrixDirectRoom } from '../../../domain/services/matrix-direct-room-open';
import { HttpMatrixClient } from '../../http/http-matrix-client';
import { TypeOrmMatrixBotRepository } from '../../typeorm/repositories/typeorm-matrix-bot.repository';
import { TypeOrmMatrixIdentityRepository } from '../../typeorm/repositories/typeorm-matrix-identity.repository';
import { TypeOrmMatrixDirectRoomRepository } from '../../typeorm/repositories/typeorm-matrix-direct-room.repository';
import { TypeOrmMatrixTicketThreadRepository } from '../../typeorm/repositories/typeorm-matrix-ticket-thread.repository';

const SUMMARY_INTERVAL_MS = 30_000;
/** Notices waiting per workspace; past it they are dropped (logged), so a stuck server cannot pile them up. */
const MAX_WAITING = 200;

interface Lane {
  tail: Promise<void>;
  waiting: number;
}

/**
 * Sends the personal notices users asked for on Matrix. One at a time per workspace, so a slow
 * Matrix server only delays its own workspace's notices; two chats opened at once for the same user
 * are settled when saved. A failure is logged and never reaches the change.
 */
@Injectable()
export class MatrixDirectNoticeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatrixDirectNoticeService.name);
  private readonly throttle = new MatrixNoticeThrottle();
  private readonly lanes = new Map<string, Lane>();
  private summaryTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly cipher: EnvSecretCipher,
    @Inject() private readonly client: HttpMatrixClient,
    @Inject() private readonly botRepository: TypeOrmMatrixBotRepository,
    @Inject() private readonly identityRepository: TypeOrmMatrixIdentityRepository,
    @Inject() private readonly directRoomRepository: TypeOrmMatrixDirectRoomRepository,
    @Inject() private readonly threadRepository: TypeOrmMatrixTicketThreadRepository,
    @Inject() private readonly ticketRepository: TypeOrmTicketRepository,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
    @Inject() private readonly frontendResolver: WorkspaceFrontendResolver,
  ) {}

  onModuleInit(): void {
    this.summaryTimer = setInterval(() => void this.sendSummaries(), SUMMARY_INTERVAL_MS);
    this.summaryTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.summaryTimer) clearInterval(this.summaryTimer);
    this.summaryTimer = null;
  }

  @OnEvent(MATRIX_PERSONAL_NOTICE_EVENT)
  onNotice(event: MatrixPersonalNoticeEvent): Promise<void> {
    return this.enqueue(event.workspaceSlug, `(${event.kind}) for ticket ${event.ticketId}`, () => this.send(event));
  }

  /** A notice that is not about a ticket; one about no workspace waits in the installation's lane. */
  @OnEvent(MATRIX_STANDALONE_NOTICE_EVENT)
  onStandaloneNotice(event: MatrixStandaloneNoticeEvent): Promise<void> {
    const about = `(${event.kind})`;
    return this.enqueue(`notice:${event.workspaceId ?? 'installation'}`, about, () => this.deliver(about, () => new NotifyMatrixStandalone(
      this.idGenerator,
      this.client,
      this.cipher,
      this.botRepository,
      this.identityRepository,
      this.directRoomRepository,
      this.userRepository,
      this.auditLogRepository,
      new OpenMatrixDirectRoom(this.idGenerator, this.client, this.cipher, this.directRoomRepository),
      (workspaceId) => (workspaceId ? this.frontendResolver.resolve(workspaceId) : Promise.resolve(this.frontendResolver.installation())),
      this.throttle,
    ).execute(event)));
  }

  private enqueue(key: string, about: string, task: () => Promise<void>): Promise<void> {
    const lane = this.lanes.get(key) ?? { tail: Promise.resolve(), waiting: 0 };
    if (lane.waiting >= MAX_WAITING) {
      this.logger.warn(`Matrix personal notice ${about} dropped: ${MAX_WAITING} already waiting in ${key}`);
      return Promise.resolve();
    }
    lane.waiting++;
    lane.tail = lane.tail.then(task).finally(() => {
      lane.waiting--;
      if (lane.waiting === 0 && this.lanes.get(key) === lane) this.lanes.delete(key);
    });
    this.lanes.set(key, lane);
    return lane.tail;
  }

  private send(event: MatrixPersonalNoticeEvent): Promise<void> {
    return this.deliver(`(${event.kind}) for ticket ${event.ticketId}`, () => new NotifyMatrixDirect(
      this.idGenerator,
      this.client,
      this.cipher,
      this.botRepository,
      this.identityRepository,
      this.directRoomRepository,
      this.threadRepository,
      this.ticketRepository,
      this.userRepository,
      this.workspaceRepository,
      this.memberRepository,
      this.auditLogRepository,
      new OpenMatrixDirectRoom(this.idGenerator, this.client, this.cipher, this.directRoomRepository),
      (workspaceId) => this.frontendResolver.resolve(workspaceId),
      this.throttle,
    ).execute(event));
  }

  /** A failure is logged, per user when only some chats failed. */
  private async deliver(about: string, notify: () => Promise<MatrixDirectNotified>): Promise<void> {
    try {
      const result = await notify();
      for (const failure of result.failures) {
        this.logger.warn(`Matrix personal notice ${about} to user ${failure.userId} failed: ${failure.error}`);
      }
    } catch (error) {
      this.logger.warn(`Matrix personal notice ${about} failed: ${(error as Error).message}`);
    }
  }

  /** One line in each chat a busy minute left notices out of. */
  private async sendSummaries(): Promise<void> {
    const skipped = new SendMatrixDirectSkipped(this.client, this.cipher, this.botRepository, this.directRoomRepository, this.userRepository);
    for (const { roomKey, skipped: count } of this.throttle.drain()) {
      const [, botId, userId] = roomKey.split(':');
      await skipped.execute({ botId, userId, count }).catch((error) => this.logger.warn(`Matrix personal summary failed: ${(error as Error).message}`));
    }
  }
}
