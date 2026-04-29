import { IdGenerator } from '../../../shared/domain/id-generator';
import { EntityNotFoundError, DomainValidationError } from '../../../shared/domain/errors';
import { WorkspaceInvitationRepository } from '../repositories/workspace-invitation.repository';
import { WorkspaceMemberRepository } from '../repositories/workspace-member.repository';
import { WorkspaceMember } from '../entities/workspace-member';
import { InvitationStatus } from '../enums/invitation-status.enum';

interface AcceptInvitationProps {
  token: string;
  userId: string;
  userEmail: string;
}

export class AcceptInvitation {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly invitationRepository: WorkspaceInvitationRepository,
    private readonly memberRepository: WorkspaceMemberRepository,
  ) {}

  async execute(props: AcceptInvitationProps): Promise<{ workspaceId: string; role: string }> {
    const invitation = await this.invitationRepository.findByToken(props.token);
    if (!invitation) {
      throw new EntityNotFoundError('Invitation not found');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new DomainValidationError('Invitation is no longer valid');
    }

    if (invitation.email !== props.userEmail) {
      throw new DomainValidationError('This invitation was sent to a different email address');
    }

    if (invitation.isExpired()) {
      invitation.cancel();
      await this.invitationRepository.update(invitation);
      throw new DomainValidationError('Invitation has expired');
    }

    const existingMember = await this.memberRepository.findByWorkspaceAndUser(
      invitation.workspaceId,
      props.userId,
    );
    if (existingMember) {
      invitation.accept();
      await this.invitationRepository.update(invitation);
      return { workspaceId: invitation.workspaceId, role: existingMember.role };
    }

    const member = new WorkspaceMember({
      id: this.idGenerator.create(),
      workspaceId: invitation.workspaceId,
      userId: props.userId,
      role: invitation.role,
    });
    await this.memberRepository.create(member);

    invitation.accept();
    await this.invitationRepository.update(invitation);

    return { workspaceId: invitation.workspaceId, role: invitation.role };
  }
}
