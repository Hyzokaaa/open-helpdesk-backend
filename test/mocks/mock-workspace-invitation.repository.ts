import { WorkspaceInvitation } from '../../src/workspace/domain/entities/workspace-invitation';
import { InvitationStatus } from '../../src/workspace/domain/enums/invitation-status.enum';
import { WorkspaceInvitationRepository } from '../../src/workspace/domain/repositories/workspace-invitation.repository';

export class MockWorkspaceInvitationRepository implements WorkspaceInvitationRepository {
  private invitations: WorkspaceInvitation[] = [];

  async create(invitation: WorkspaceInvitation): Promise<void> {
    this.invitations.push(invitation);
  }

  async findById(id: string): Promise<WorkspaceInvitation | null> {
    return this.invitations.find((i) => i.getId() === id) ?? null;
  }

  async findByToken(token: string): Promise<WorkspaceInvitation | null> {
    return this.invitations.find((i) => i.token === token) ?? null;
  }

  async findPendingByWorkspaceId(workspaceId: string): Promise<WorkspaceInvitation[]> {
    return this.invitations.filter(
      (i) => i.workspaceId === workspaceId && i.status === InvitationStatus.PENDING,
    );
  }

  async findPendingByWorkspaceAndEmail(workspaceId: string, email: string): Promise<WorkspaceInvitation | null> {
    return (
      this.invitations.find(
        (i) => i.workspaceId === workspaceId && i.email === email && i.status === InvitationStatus.PENDING,
      ) ?? null
    );
  }

  async update(invitation: WorkspaceInvitation): Promise<void> {
    const index = this.invitations.findIndex((i) => i.getId() === invitation.getId());
    if (index >= 0) this.invitations[index] = invitation;
  }

  all(): WorkspaceInvitation[] {
    return this.invitations;
  }

  seed(invitation: WorkspaceInvitation): void {
    this.invitations.push(invitation);
  }

  async findExpiredUnnotified(now: Date, limit: number): Promise<WorkspaceInvitation[]> {
    return this.invitations
      .filter((i) => i.status === InvitationStatus.PENDING && i.expiresAt <= now && !i.expiryNotifiedAt)
      .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime())
      .slice(0, limit);
  }
}
