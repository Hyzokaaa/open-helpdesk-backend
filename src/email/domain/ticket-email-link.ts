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
  /** Whether the workspace's portal is open to people who are not signed in. */
  portalEnabled: boolean;
  /** The recipient only ever wrote in (by email, the portal or through the API): no sign-in of their own. */
  autoCreated: boolean;
}

/**
 * Where an email sends its reader, or null when it should send them nowhere. The team opens the
 * ticket in the dashboard. A customer of the workspace opens it in the portal, which needs no
 * password, through their own link: what they write there is theirs, also when they are not the
 * reporter (a colleague in copy who answered). While the portal is closed a customer with an
 * account goes to the dashboard, which asks them to sign in, and one who only ever wrote in gets
 * no link: the email tells them to reply to it instead. Someone no longer in the workspace gets the
 * dashboard link, which asks them to sign in, so leaving the workspace is not undone by the next email.
 */
export class ResolveTicketEmailLink {
  constructor(private readonly ensurePortalAccess: EnsureTicketPortalAccess) {}

  async execute(props: Props): Promise<string | null> {
    const dashboard = `${props.frontendUrl}/dashboard/workspaces/${props.workspaceSlug}/tickets/${props.ticketId}`;
    const isCustomer = !props.isSystemAdmin && props.role === WorkspaceRole.USER;
    if (!isCustomer || !props.userId) return dashboard;

    if (!props.portalEnabled) return props.autoCreated ? null : dashboard;
    const access = await this.ensurePortalAccess.execute({ ticketId: props.ticketId, userId: props.userId });
    return `${props.frontendUrl}/portal/tickets/${access.token}`;
  }
}
