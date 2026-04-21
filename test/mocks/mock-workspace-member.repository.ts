import { WorkspaceMember } from '../../src/workspace/domain/entities/workspace-member';
import { WorkspaceMemberRepository } from '../../src/workspace/domain/repositories/workspace-member.repository';

export class MockWorkspaceMemberRepository implements WorkspaceMemberRepository {
  private members: WorkspaceMember[] = [];

  async create(member: WorkspaceMember): Promise<void> {
    this.members.push(member);
  }

  async findByWorkspaceId(workspaceId: string): Promise<WorkspaceMember[]> {
    return this.members.filter((m) => m.workspaceId === workspaceId);
  }

  async findByUserId(userId: string): Promise<WorkspaceMember[]> {
    return this.members.filter((m) => m.userId === userId);
  }

  async findByWorkspaceAndUser(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
    return this.members.find((m) => m.workspaceId === workspaceId && m.userId === userId) ?? null;
  }

  async update(member: WorkspaceMember): Promise<void> {
    const index = this.members.findIndex((m) => m.getId() === member.getId());
    if (index >= 0) this.members[index] = member;
  }

  async delete(id: string): Promise<void> {
    this.members = this.members.filter((m) => m.getId() !== id);
  }

  seed(member: WorkspaceMember): void {
    this.members.push(member);
  }
}
