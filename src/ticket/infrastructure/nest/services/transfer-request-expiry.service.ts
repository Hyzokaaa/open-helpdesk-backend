import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { TypeOrmTransferRequestRepository } from '../../typeorm/repositories/typeorm-transfer-request.repository';
import { NestEventPublisher } from '../../../../shared/infrastructure/nest-event-publisher';
import { TypeOrmTicketRepository } from '../../typeorm/repositories/typeorm-ticket.repository';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
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
      }
    } catch (error) {
      this.logger.error(`Transfer request expiry check failed: ${error}`);
    }
  }
}
