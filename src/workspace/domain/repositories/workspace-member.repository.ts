import { WorkspaceMember } from '../entities/workspace-member';

export interface WorkspaceMemberRepository {
  create(member: WorkspaceMember): Promise<void>;
  findByWorkspaceId(workspaceId: string): Promise<WorkspaceMember[]>;
  findByUserId(userId: string): Promise<WorkspaceMember[]>;
  findByWorkspaceAndUser(workspaceId: string, userId: string): Promise<WorkspaceMember | null>;
  update(member: WorkspaceMember): Promise<void>;
  delete(id: string): Promise<void>;
}
