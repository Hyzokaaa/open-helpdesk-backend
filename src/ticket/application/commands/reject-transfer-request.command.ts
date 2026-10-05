import { Command } from '../../../shared/domain/command';
import { EventPublisher } from '../../../shared/domain/event-publisher';
import { RejectTransferRequest } from '../../domain/services/transfer-request-reject';
import { TicketRepository } from '../../domain/repositories/ticket.repository';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';
import { TransferRequestResolvedEvent } from '../../../email/domain/events';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';

interface Props {
  ticketId: string;
  requestId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface RejectTransferRequestResponse {
  id: string;
  status: 'rejected';
}

export class RejectTransferRequestCommand implements Command<Props, RejectTransferRequestResponse> {
  constructor(
    private readonly rejectTransferRequest: RejectTransferRequest,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly ticketRepository: TicketRepository,
    private readonly eventPublisher: EventPublisher,
    private readonly createAuditLog: CreateAuditLogEntry,
  ) {}

  async execute(props: Props): Promise<RejectTransferRequestResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.TRANSFER_REQUEST_RESPOND,
      isSystemAdmin: props.isSystemAdmin,
    });

    const request = await this.rejectTransferRequest.execute({
      requestId: props.requestId,
      ticketId: props.ticketId,
      workspaceId: props.workspaceId,
      userId: props.userId,
    });

    const ticket = await this.ticketRepository.findById(props.ticketId);

    await this.createAuditLog.execute({
      action: AuditAction.TRANSFER_REQUEST_REJECTED,
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source: 'ui',
      entityType: 'ticket',
      entityId: props.ticketId,
      userId: props.userId,
      workspaceId: props.workspaceId,
      metadata: { ticketName: ticket?.name, requestId: props.requestId },
    });

    const event: TransferRequestResolvedEvent = {
      requestId: props.requestId,
      ticketId: props.ticketId,
      ticketName: ticket?.name ?? '',
      requesterId: request.requesterId,
      targetUserId: request.targetUserId,
      resolution: 'rejected',
      workspaceId: props.workspaceId,
      workspaceName: props.workspaceName,
      workspaceSlug: props.workspaceSlug,
    };
    this.eventPublisher.emit('transfer-request.resolved', event);

    return { id: props.ticketId, status: 'rejected' };
  }
}
