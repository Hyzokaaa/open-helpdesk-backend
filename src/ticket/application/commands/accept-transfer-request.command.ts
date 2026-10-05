import { Command } from '../../../shared/domain/command';
import { EventPublisher } from '../../../shared/domain/event-publisher';
import { AcceptTransferRequest } from '../../domain/services/transfer-request-accept';
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

export interface AcceptTransferRequestResponse {
  id: string;
  assigneeId: string | null;
  status: 'accepted';
}

export class AcceptTransferRequestCommand implements Command<Props, AcceptTransferRequestResponse> {
  constructor(
    private readonly acceptTransferRequest: AcceptTransferRequest,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly eventPublisher: EventPublisher,
    private readonly createAuditLog: CreateAuditLogEntry,
  ) {}

  async execute(props: Props): Promise<AcceptTransferRequestResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.TRANSFER_REQUEST_RESPOND,
      isSystemAdmin: props.isSystemAdmin,
    });

    const { request, ticket } = await this.acceptTransferRequest.execute({
      requestId: props.requestId,
      ticketId: props.ticketId,
      workspaceId: props.workspaceId,
      userId: props.userId,
    });

    await this.createAuditLog.execute({
      action: AuditAction.TRANSFER_REQUEST_ACCEPTED,
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source: 'ui',
      entityType: 'ticket',
      entityId: props.ticketId,
      userId: props.userId,
      workspaceId: props.workspaceId,
      metadata: { ticketName: ticket.name, requestId: props.requestId },
    });

    const event: TransferRequestResolvedEvent = {
      requestId: props.requestId,
      ticketId: props.ticketId,
      ticketName: ticket.name,
      requesterId: request.requesterId,
      targetUserId: request.targetUserId,
      resolution: 'accepted',
      workspaceId: props.workspaceId,
      workspaceName: props.workspaceName,
      workspaceSlug: props.workspaceSlug,
    };
    this.eventPublisher.emit('transfer-request.resolved', event);

    return { id: ticket.getId(), assigneeId: ticket.assigneeId, status: 'accepted' };
  }
}
