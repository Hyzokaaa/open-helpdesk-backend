import { Inject, Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { TypeOrmTransferRequestRepository } from '../../typeorm/repositories/typeorm-transfer-request.repository';
import { NestEventPublisher } from '../../../../shared/infrastructure/nest-event-publisher';
import { TypeOrmTicketRepository } from '../../typeorm/repositories/typeorm-ticket.repository';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';
import { TransferRequestResolvedEvent } from '../../../../email/domain/events';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

@Injectable()
export class TransferRequestExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TransferRequestExpiryService.name);
  private intervalRef: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly transferRequestRepository: TypeOrmTransferRequestRepository,
    private readonly ticketRepository: TypeOrmTicketRepository,
    private readonly userRepository: TypeOrmUserRepository,
    private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    private readonly eventPublisher: NestEventPublisher,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
  ) {}

  onModuleInit(): void {
    this.intervalRef = setInterval(() => this.expire(), FIFTEEN_MINUTES_MS);
  }

  onModuleDestroy(): void {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
  }

  async expire(): Promise<void> {
    try {
      const expired = await this.transferRequestRepository.expirePendingBefore(new Date());
      if (expired.length === 0) return;

      this.logger.log(`Expired ${expired.length} transfer request(s)`);

      for (const request of expired) {
        const ticket = await this.ticketRepository.findById(request.ticketId);
        if (!ticket) continue;
        const workspace = await this.workspaceRepository.findById(ticket.workspaceId);
        if (!workspace) continue;

        const event: TransferRequestResolvedEvent = {
          requestId: request.getId(),
          ticketId: request.ticketId,
          ticketName: ticket.name,
          requesterId: request.requesterId,
          targetUserId: request.targetUserId,
          resolution: 'cancelled',
          workspaceId: workspace.getId(),
          workspaceName: workspace.name,
          workspaceSlug: workspace.slug,
        };
        this.eventPublisher.emit('transfer-request.resolved', event);

        const auditService = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
        await auditService.execute({
          action: AuditAction.TRANSFER_REQUEST_EXPIRED,
          entityType: 'transfer-request',
          entityId: request.getId(),
          userId: null,
          workspaceId: workspace.getId(),
          metadata: { ticketId: request.ticketId, requesterId: request.requesterId, targetUserId: request.targetUserId },
          category: AuditCategory.TICKET,
          level: AuditLevel.INFO,
          source: 'system',
        });
      }
    } catch (error) {
      this.logger.error(`Transfer request expiry check failed: ${error}`);
    }
  }
}
