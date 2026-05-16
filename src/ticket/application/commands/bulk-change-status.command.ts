import { Command } from '../../../shared/domain/command';
import { TicketDiscardReason } from '../../domain/enums/ticket-discard-reason.enum';
import { TicketStatus } from '../../domain/enums/ticket-status.enum';
import { ChangeTicketStatusCommand } from './change-ticket-status.command';

interface Props {
  ticketIds: string[];
  status: TicketStatus;
  discardReason?: TicketDiscardReason;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface BulkResult {
  ticketId: string;
  success: boolean;
  error?: string;
}

export class BulkChangeStatusCommand implements Command<Props, BulkResult[]> {
  constructor(
    private readonly changeStatusCommand: ChangeTicketStatusCommand,
  ) {}

  async execute(props: Props): Promise<BulkResult[]> {
    const results: BulkResult[] = [];

    for (const ticketId of props.ticketIds) {
      try {
        await this.changeStatusCommand.execute({
          ticketId,
          status: props.status,
          discardReason: props.discardReason,
          workspaceId: props.workspaceId,
          workspaceName: props.workspaceName,
          workspaceSlug: props.workspaceSlug,
          userId: props.userId,
          isSystemAdmin: props.isSystemAdmin,
        });
        results.push({ ticketId, success: true });
      } catch (err: any) {
        results.push({ ticketId, success: false, error: err.message });
      }
    }

    return results;
  }
}
