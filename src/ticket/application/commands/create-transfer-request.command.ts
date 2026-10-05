import { Command } from '../../../shared/domain/command';
import { EventPublisher } from '../../../shared/domain/event-publisher';
import { CreateTransferRequest } from '../../domain/services/transfer-request-create';
import { EnsureTicketAccess } from '../../domain/services/ticket-ensure-access';
import { EnsureTicketAssignee } from '../../domain/services/ticket-ensure-assignee';
import { AddTicketParticipant } from '../../domain/services/ticket-add-participant';
import { ParticipantRole } from '../../domain/enums/participant-role.enum';
import { TicketRepository } from '../../domain/repositories/ticket.repository';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';
import { TransferRequestCreatedEvent } from '../../../email/domain/events';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';

interface Props {
  ticketId: string;
  targetUserId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface CreateTransferRequestResponse {
  id: string;
  transferRequestId: string;
  status: 'pending';
  expiresAt: Date;
}

export class CreateTransferRequestCommand implements Command<Props, CreateTransferRequestResponse> {
  constructor(
    private readonly createTransferRequest: CreateTransferRequest,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly ensureTicketAccess: EnsureTicketAccess,
    private readonly ensureAssignee: EnsureTicketAssignee,
    private readonly ticketRepository: TicketRepository,
    private readonly userRepository: UserRepository,
    private readonly eventPublisher: EventPublisher,
    private readonly createAuditLog: CreateAuditLogEntry,
    private readonly addParticipant: AddTicketParticipant,
  ) {}

  async execute(props: Props): Promise<CreateTransferRequestResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.TICKET_TRANSFER,
      isSystemAdmin: props.isSystemAdmin,
    });
    await this.ensureTicketAccess.ensureFull({
      ticketId: props.ticketId,
      workspaceId: props.workspaceId,
      userId: props.userId,
      isSystemAdmin: props.isSystemAdmin,
    });
    await this.ensureAssignee.execute({ workspaceId: props.workspaceId, userId: props.targetUserId });

    const request = await this.createTransferRequest.execute({
      ticketId: props.ticketId,
      workspaceId: props.workspaceId,
      requesterId: props.userId,
      targetUserId: props.targetUserId,
    });

    const ticket = await this.ticketRepository.findById(props.ticketId);
    const [fromUser, toUser] = await Promise.all([
      this.userRepository.findById(props.userId),
      this.userRepository.findById(props.targetUserId),
    ]);
    const fromName = fromUser ? `${fromUser.firstName} ${fromUser.lastName}` : props.userId;

    await this.createAuditLog.execute({
      action: AuditAction.TRANSFER_REQUEST_CREATED,
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source: 'ui',
      entityType: 'ticket',
      entityId: props.ticketId,
      userId: props.userId,
      workspaceId: props.workspaceId,
      metadata: {
        ticketName: ticket?.name,
        requestId: request.getId(),
        from: fromName,
        to: toUser ? `${toUser.firstName} ${toUser.lastName}` : props.targetUserId,
      },
    });

    const event: TransferRequestCreatedEvent = {
      requestId: request.getId(),
      ticketId: props.ticketId,
      ticketName: ticket?.name ?? '',
      requesterId: props.userId,
      requesterName: fromName,
      targetUserId: props.targetUserId,
      workspaceId: props.workspaceId,
      workspaceName: props.workspaceName,
      workspaceSlug: props.workspaceSlug,
      expiresAt: request.expiresAt,
    };
    this.eventPublisher.emit('transfer-request.created', event);

    // The target follows the ticket so they can read it while deciding.
    await this.addParticipant.execute({
      ticketId: props.ticketId,
      userId: props.targetUserId,
      role: ParticipantRole.FOLLOWER,
    });

    return { id: props.ticketId, transferRequestId: request.getId(), status: 'pending', expiresAt: request.expiresAt };
  }
}
