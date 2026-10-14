import { WorkspaceRole } from '../../workspace/domain/enums/workspace-role.enum';

interface TicketLinkProps {
  frontendUrl: string;
  workspaceSlug: string;
  ticketId: string;
  portalToken: string | null | undefined;
  /** The recipient's role in the workspace, or null when they are not a member. */
  role: WorkspaceRole | null;
  isSystemAdmin: boolean;
}

/**
 * Where an email sends its reader: the team opens the ticket in the dashboard; a customer opens
 * it in the portal, which needs no password and is where an emailed customer can follow it.
 */
export function ticketLinkFor(props: TicketLinkProps): string {
  const isCustomer = !props.isSystemAdmin && (props.role === null || props.role === WorkspaceRole.USER);
  if (isCustomer && props.portalToken) return `${props.frontendUrl}/portal/tickets/${props.portalToken}`;
  return `${props.frontendUrl}/dashboard/workspaces/${props.workspaceSlug}/tickets/${props.ticketId}`;
}
