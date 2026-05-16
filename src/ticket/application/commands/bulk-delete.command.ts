import { Command } from '../../../shared/domain/command';
import { DeleteTicketCommand } from './delete-ticket.command';

interface Props {
  ticketIds: string[];
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface BulkResult {
  ticketId: string;
  success: boolean;
  error?: string;
}

export class BulkDeleteCommand implements Command<Props, BulkResult[]> {
  constructor(
    private readonly deleteCommand: DeleteTicketCommand,
  ) {}

  async execute(props: Props): Promise<BulkResult[]> {
    const results: BulkResult[] = [];

    for (const ticketId of props.ticketIds) {
      try {
        await this.deleteCommand.execute({
          ticketId,
          workspaceId: props.workspaceId,
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
