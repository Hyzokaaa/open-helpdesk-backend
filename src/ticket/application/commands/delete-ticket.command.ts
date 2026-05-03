import { Command } from '../../../shared/domain/command';
import { DeleteTicket } from '../../domain/services/ticket-delete';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { TicketRepository } from '../../domain/repositories/ticket.repository';

interface Props {
  ticketId: string;
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export class DeleteTicketCommand implements Command<Props, void> {
  constructor(
    private readonly deleteTicket: DeleteTicket,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly ticketRepository: TicketRepository,
    private readonly createAuditLog: CreateAuditLogEntry,
  ) {}

  async execute(props: Props): Promise<void> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.TICKET_DELETE,
      isSystemAdmin: props.isSystemAdmin,
    });

    const ticket = await this.ticketRepository.findById(props.ticketId);
    await this.deleteTicket.execute({ ticketId: props.ticketId });

    await this.createAuditLog.execute({
      action: AuditAction.TICKET_DELETED,
      entityType: 'ticket',
      entityId: props.ticketId,
      userId: props.userId,
      workspaceId: props.workspaceId,
      metadata: { name: ticket?.name ?? null },
    });
  }
}
