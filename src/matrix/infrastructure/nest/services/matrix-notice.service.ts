import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { STORAGE_SERVICE } from '../../../../shared/shared.module';
import { StorageService } from '../../../../shared/domain/storage-service';
import { TypeOrmAttachmentRepository } from '../../../../attachment/infrastructure/typeorm/repositories/typeorm-attachment.repository';
import { AttachmentMatrixFileSource } from '../../attachment/attachment-matrix-file-source';
import { OnEvent } from '@nestjs/event-emitter';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { EnvSecretCipher } from '../../../../shared/infrastructure/aes-secret-cipher';
import { WorkspaceFrontendResolver } from '../../../../shared/infrastructure/workspace-frontend-resolver';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { TypeOrmTicketRepository } from '../../../../ticket/infrastructure/typeorm/repositories/typeorm-ticket.repository';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmDepartmentRepository } from '../../../../department/infrastructure/typeorm/repositories/typeorm-department.repository';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { NewCommentEvent, StatusChangedEvent, TicketAssignedEvent, TicketCreatedEvent, TicketReopenedEvent, TicketSlaBreachedEvent } from '../../../../email/domain/events';
import { MatrixNoticeEvent } from '../../../domain/enums/matrix-notice-event.enum';
import { MatrixNoticeThrottle } from '../../../domain/matrix-notice-throttle';
import { DeliverMatrixNotice } from '../../../domain/services/matrix-notice-deliver';
import { NotifyMatrixRooms } from '../../../domain/services/matrix-rooms-notify';
import { SendMatrixPlainNotice } from '../../../domain/services/matrix-plain-notice-send';
import { HttpMatrixClient } from '../../http/http-matrix-client';
import { TypeOrmMatrixBotRepository } from '../../typeorm/repositories/typeorm-matrix-bot.repository';
import { TypeOrmMatrixRoomRepository } from '../../typeorm/repositories/typeorm-matrix-room.repository';
import { TypeOrmMatrixTicketThreadRepository } from '../../typeorm/repositories/typeorm-matrix-ticket-thread.repository';

const SUMMARY_INTERVAL_MS = 30_000;

/**
 * Tells the workspaces' Matrix rooms what happens to their tickets. Runs after the change, apart
 * from it: a failure here is logged and never reaches the ticket, comment or check that caused it.
 */
@Injectable()
export class MatrixNoticeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatrixNoticeService.name);
  private readonly throttle = new MatrixNoticeThrottle();
  private summaryTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly cipher: EnvSecretCipher,
    @Inject() private readonly client: HttpMatrixClient,
    @Inject() private readonly botRepository: TypeOrmMatrixBotRepository,
    @Inject() private readonly roomRepository: TypeOrmMatrixRoomRepository,
    @Inject() private readonly threadRepository: TypeOrmMatrixTicketThreadRepository,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
    @Inject() private readonly ticketRepository: TypeOrmTicketRepository,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly departmentRepository: TypeOrmDepartmentRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly frontendResolver: WorkspaceFrontendResolver,
    @Inject() private readonly attachmentRepository: TypeOrmAttachmentRepository,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  onModuleInit(): void {
    this.summaryTimer = setInterval(() => void this.sendSummaries(), SUMMARY_INTERVAL_MS);
    this.summaryTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.summaryTimer) clearInterval(this.summaryTimer);
    this.summaryTimer = null;
  }

  @OnEvent('ticket.created')
  async onTicketCreated(event: TicketCreatedEvent): Promise<void> {
    await this.notify({ event: MatrixNoticeEvent.TICKET_CREATED, workspaceId: event.workspaceId, ticketId: event.ticketId, occurrence: 'created' });
  }

  @OnEvent('ticket.assigned')
  async onTicketAssigned(event: TicketAssignedEvent): Promise<void> {
    // The status change that caused it tells both in one notice
    if (event.followsStatusChange) return;
    await this.notify({ event: MatrixNoticeEvent.TICKET_ASSIGNED, assigneeId: event.newAssigneeId, statusChange: event.statusChange, workspaceId: event.workspaceId, ticketId: event.ticketId, occurrence: `${event.newAssigneeId ?? 'none'}-${Date.now()}` });
  }

  @OnEvent('ticket.statusChanged')
  async onStatusChanged(event: StatusChangedEvent): Promise<void> {
    if (event.quiet) return;
    await this.notify({ event: MatrixNoticeEvent.STATUS_CHANGED, oldStatus: event.oldStatus, newStatus: event.newStatus, reopened: false, actorId: event.changedById, assigneeChange: event.assigneeChange, workspaceId: event.workspaceId, ticketId: event.ticketId, occurrence: `${event.newStatus}-${Date.now()}` });
  }

  @OnEvent('ticket.reopened')
  async onReopened(event: TicketReopenedEvent): Promise<void> {
    await this.notify({ event: MatrixNoticeEvent.STATUS_CHANGED, oldStatus: event.oldStatus, newStatus: event.newStatus, reopened: true, actorId: event.reopenedById, workspaceId: event.workspaceId, ticketId: event.ticketId, occurrence: `reopened-${event.reopenCount}` });
  }

  @OnEvent('comment.created')
  async onComment(event: NewCommentEvent): Promise<void> {
    await this.notify({ event: MatrixNoticeEvent.CUSTOMER_REPLY, authorId: event.authorId, commentId: event.commentId, commentText: event.commentContent, workspaceId: event.workspaceId, ticketId: event.ticketId, occurrence: event.commentId });
  }

  @OnEvent('ticket.slaBreached')
  async onSlaBreached(event: TicketSlaBreachedEvent): Promise<void> {
    await this.notify({ event: MatrixNoticeEvent.SLA_BREACHED, target: event.target, workspaceId: event.workspaceId, ticketId: event.ticketId, occurrence: event.target });
  }

  private async notify(props: Parameters<NotifyMatrixRooms['execute']>[0]): Promise<void> {
    try {
      await new NotifyMatrixRooms(
        this.roomRepository,
        this.botRepository,
        this.ticketRepository,
        this.userRepository,
        this.departmentRepository,
        this.workspaceRepository,
        this.memberRepository,
        (workspaceId) => this.frontendResolver.resolve(workspaceId),
        this.throttle,
        this.deliver(),
        new AttachmentMatrixFileSource(this.attachmentRepository, this.storage),
      ).execute(props);
    } catch (error) {
      this.logger.warn(`Matrix notice (${props.event}) for ticket ${props.ticketId} failed: ${(error as Error).message}`);
    }
  }

  private async sendSummaries(): Promise<void> {
    const plain = new SendMatrixPlainNotice(this.roomRepository, this.botRepository, this.workspaceRepository, this.deliver());
    for (const { roomKey, skipped } of this.throttle.drain()) {
      await plain.skipped(roomKey, skipped).catch((error) => this.logger.warn(`Matrix summary failed: ${(error as Error).message}`));
    }
  }

  private deliver(): DeliverMatrixNotice {
    return new DeliverMatrixNotice(this.idGenerator, this.client, this.cipher, this.roomRepository, this.threadRepository, this.auditLogRepository);
  }
}
