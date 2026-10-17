import { TicketPortalAccess } from '../entities/ticket-portal-access';

export interface TicketPortalAccessRepository {
  create(access: TicketPortalAccess): Promise<void>;
  findByToken(token: string): Promise<TicketPortalAccess | null>;
  findByTicketAndUser(ticketId: string, userId: string): Promise<TicketPortalAccess | null>;
  findByTicketIds(ticketIds: string[]): Promise<TicketPortalAccess[]>;
  remove(ticketId: string, userId: string): Promise<void>;
  /** Removes the person's links to every ticket of the workspace. */
  removeByUserInWorkspace(userId: string, workspaceId: string): Promise<void>;
}
