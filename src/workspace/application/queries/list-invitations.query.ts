import { Query } from '../../../shared/domain/query';
import { WorkspaceInvitationRepository } from '../../domain/repositories/workspace-invitation.repository';

interface Props {
  workspaceId: string;
}

export interface InvitationListItem {
  id: string;
  email: string;
  role: string;
  status: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export class ListInvitationsQuery implements Query<Props, InvitationListItem[]> {
  constructor(private readonly repository: WorkspaceInvitationRepository) {}

  async execute(props: Props): Promise<InvitationListItem[]> {
    const invitations = await this.repository.findPendingByWorkspaceId(props.workspaceId);
    return invitations.map((inv) => ({
      id: inv.getId(),
      email: inv.email,
      role: inv.role,
      status: inv.status,
      token: inv.token,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    }));
  }
}
