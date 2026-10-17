import { WorkspaceRole } from '../../workspace/domain/enums/workspace-role.enum';
import { EnsureTicketPortalAccess } from '../../ticket/domain/services/ticket-portal-access-ensure';

interface Props {
  frontendUrl: string;
  workspaceSlug: string;
  ticketId: string;
  /** The recipient, or null when the address is not a known user. */
  userId: string | null;
  /** The recipient's role in the workspace, or null when they are not a member. */
  role: WorkspaceRole | null;
  isSystemAdmin: boolean;
}

/**
 * Where an email sends its reader. The team opens the ticket in the dashboard. A customer of
 * the workspace opens it in the portal, which needs no password, through their own link: what
 * they write there is theirs, also when they are not the reporter (a colleague in copy who
 * answered). Someone no longer in the workspace gets the dashboard link, which asks them to
 * sign in, so leaving the workspace is not undone by the next email.
 */
export class ResolveTicketEmailLink {
  constructor(private readonly ensurePortalAccess: EnsureTicketPortalAccess) {}

  async execute(props: Props): Promise<string> {
    const isCustomer = !props.isSystemAdmin && props.role === WorkspaceRole.USER;
    if (isCustomer && props.userId) {
      const access = await this.ensurePortalAccess.execute({ ticketId: props.ticketId, userId: props.userId });
      return `${props.frontendUrl}/portal/tickets/${access.token}`;
    }
    return `${props.frontendUrl}/dashboard/workspaces/${props.workspaceSlug}/tickets/${props.ticketId}`;
  }
}
