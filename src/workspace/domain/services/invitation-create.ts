import { IdGenerator } from '../../../shared/domain/id-generator';
import { TokenService } from '../../../shared/domain/token-service';
import { ConflictError } from '../../../shared/domain/errors';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { WorkspaceMemberRepository } from '../repositories/workspace-member.repository';
import { WorkspaceInvitationRepository } from '../repositories/workspace-invitation.repository';
import { WorkspaceInvitation } from '../entities/workspace-invitation';
import { WorkspaceRole } from '../enums/workspace-role.enum';
import { InvitationStatus } from '../enums/invitation-status.enum';

interface CreateInvitationProps {
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  invitedById: string;
}

export class CreateInvitation {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly invitationRepository: WorkspaceInvitationRepository,
    private readonly memberRepository: WorkspaceMemberRepository,
    private readonly userRepository: UserRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(props: CreateInvitationProps): Promise<WorkspaceInvitation> {
    const existingUser = await this.userRepository.findByEmail(props.email);
    if (existingUser) {
      const existingMember = await this.memberRepository.findByWorkspaceAndUser(
        props.workspaceId,
        existingUser.getId(),
      );
      if (existingMember) {
        throw new ConflictError('User is already a member of this workspace');
      }
    }

    const pendingInvitation = await this.invitationRepository.findPendingByWorkspaceAndEmail(
      props.workspaceId,
      props.email,
    );
    if (pendingInvitation) {
      throw new ConflictError('A pending invitation already exists for this email');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const token = this.tokenService.sign(
      { workspaceId: props.workspaceId, email: props.email, type: 'workspace-invitation' },
      { expiresIn: '7d' },
    );

    const invitation = new WorkspaceInvitation({
      id: this.idGenerator.create(),
      workspaceId: props.workspaceId,
      email: props.email,
      role: props.role,
      token,
      status: InvitationStatus.PENDING,
      expiresAt,
      invitedById: props.invitedById,
    });

    await this.invitationRepository.create(invitation);
    return invitation;
  }
}
