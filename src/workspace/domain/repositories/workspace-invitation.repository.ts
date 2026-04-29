import { WorkspaceInvitation } from '../entities/workspace-invitation';

export interface WorkspaceInvitationRepository {
  create(invitation: WorkspaceInvitation): Promise<void>;
  findById(id: string): Promise<WorkspaceInvitation | null>;
  findByToken(token: string): Promise<WorkspaceInvitation | null>;
  findPendingByWorkspaceId(workspaceId: string): Promise<WorkspaceInvitation[]>;
  findPendingByWorkspaceAndEmail(workspaceId: string, email: string): Promise<WorkspaceInvitation | null>;
  update(invitation: WorkspaceInvitation): Promise<void>;
}
