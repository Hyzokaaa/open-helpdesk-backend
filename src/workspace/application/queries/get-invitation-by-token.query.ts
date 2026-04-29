import { Query } from '../../../shared/domain/query';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { WorkspaceInvitationRepository } from '../../domain/repositories/workspace-invitation.repository';
import { WorkspaceRepository } from '../../domain/repositories/workspace.repository';

interface Props {
  token: string;
}

export interface InvitationDetail {
  id: string;
  workspaceName: string;
  email: string;
  role: string;
  status: string;
  expiresAt: Date;
  accountExists: boolean;
}

export class GetInvitationByTokenQuery implements Query<Props, InvitationDetail | null> {
  constructor(
    private readonly invitationRepository: WorkspaceInvitationRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(props: Props): Promise<InvitationDetail | null> {
    const invitation = await this.invitationRepository.findByToken(props.token);
    if (!invitation) return null;

    const workspace = await this.workspaceRepository.findById(invitation.workspaceId);
    const existingUser = await this.userRepository.findByEmail(invitation.email);

    return {
      id: invitation.getId(),
      workspaceName: workspace?.name ?? '',
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      accountExists: !!existingUser,
    };
  }
}
