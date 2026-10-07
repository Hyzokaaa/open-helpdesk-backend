import { Command } from '../../../shared/domain/command';
import { EntityNotFoundError } from '../../../shared/domain/errors';
import { DeleteTicket } from '../../domain/services/ticket-delete';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';
import { TicketRepository } from '../../domain/repositories/ticket.repository';
import { EventPublisher } from '../../../shared/domain/event-publisher';
import { TicketDeletedEvent } from '../../../email/domain/events';
import { ticketReferenceOf } from '../../domain/ticket-reference';

interface Props {
  ticketId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  userId: string;
  isSystemAdmin: boolean;
  /** Set when the action came through the public API, with the key that made it. */
  apiKeyId?: string;
}

export class DeleteTicketCommand implements Command<Props, void> {
  constructor(
    private readonly deleteTicket: DeleteTicket,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly ticketRepository: TicketRepository,
    private readonly createAuditLog: CreateAuditLogEntry,
    private readonly eventPublisher?: EventPublisher,
  ) {}

  async execute(props: Props): Promise<void> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.TICKET_DELETE,
      isSystemAdmin: props.isSystemAdmin,
    });

    const ticket = await this.ticketRepository.findById(props.ticketId);
    if (!ticket || ticket.workspaceId !== props.workspaceId) throw new EntityNotFoundError('Ticket not found');
    await this.deleteTicket.execute({ ticketId: props.ticketId });

    await this.createAuditLog.execute({
      action: AuditAction.TICKET_DELETED,
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source: props.apiKeyId ? 'api' : 'ui',
      entityType: 'ticket',
      entityId: props.ticketId,
      userId: props.userId,
      workspaceId: props.workspaceId,
      metadata: { ...(props.apiKeyId ? { apiKeyId: props.apiKeyId } : {}), name: ticket?.name ?? null },
    });

    const event: TicketDeletedEvent = {
      ticketId: props.ticketId,
      ticketNumber: ticketReferenceOf(ticket),
      ticketName: ticket.name,
      deletedById: props.userId,
      workspaceId: props.workspaceId,
      workspaceName: props.workspaceName,
      workspaceSlug: props.workspaceSlug,
    };
    this.eventPublisher?.emit('ticket.deleted', event);
  }
}
