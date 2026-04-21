import { Command } from '../../../shared/domain/command';
import { DeleteTicket } from '../../domain/services/ticket-delete';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  ticketId: string;
  workspaceId: string;
  userId: string;
}

export class DeleteTicketCommand implements Command<Props, void> {
  constructor(
    private readonly deleteTicket: DeleteTicket,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<void> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.TICKET_DELETE,
    });

    await this.deleteTicket.execute({ ticketId: props.ticketId });
  }
}
