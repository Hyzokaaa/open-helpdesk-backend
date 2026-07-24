import { WorkspaceEmailSender } from '../entities/workspace-email-sender';

export interface WorkspaceEmailSenderRepository {
  create(sender: WorkspaceEmailSender): Promise<void>;
  findByWorkspaceId(workspaceId: string): Promise<WorkspaceEmailSender | null>;
  update(sender: WorkspaceEmailSender): Promise<void>;
  delete(workspaceId: string): Promise<void>;
}
