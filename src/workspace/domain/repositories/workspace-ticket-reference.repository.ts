import { WorkspaceTicketReference } from '../entities/workspace-ticket-reference';

export interface WorkspaceTicketReferenceRepository {
  /** Null when the workspace never changed its references (the default format applies). */
  findByWorkspaceId(workspaceId: string): Promise<WorkspaceTicketReference | null>;
  save(reference: WorkspaceTicketReference): Promise<void>;
}
