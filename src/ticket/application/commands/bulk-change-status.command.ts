import { Command } from '../../../shared/domain/command';
import { TicketDiscardReason } from '../../domain/enums/ticket-discard-reason.enum';
import { TicketStatus } from '../../domain/enums/ticket-status.enum';
import { ChangeTicketStatusCommand } from './change-ticket-status.command';
import { USE_REOPEN_MESSAGE } from '../../domain/services/ticket-change-status';
import { NEEDS_ASSIGNEE_MESSAGE } from '../../domain/ticket-assignment-rule';

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
  /** A closed ticket asked to go back to work: it has to be reopened one by one, with a reason. */
  needsReopen?: boolean;
  /** Asked to go to work with nobody assigned: bulk does not take tickets for whoever moves them. */
  needsAssignee?: boolean;
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
          takeIfUnassigned: false,
        });
        results.push({ ticketId, success: true });
      } catch (err: any) {
        results.push({ ticketId, success: false, error: err.message, ...(err.message === USE_REOPEN_MESSAGE ? { needsReopen: true } : {}), ...(err.message === NEEDS_ASSIGNEE_MESSAGE ? { needsAssignee: true } : {}) });
      }
    }

    return results;
  }
}
