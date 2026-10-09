import { EntityNotFoundError, DomainValidationError } from '../../../shared/domain/errors';
import { WorkspaceInvitationRepository } from '../repositories/workspace-invitation.repository';
import { InvitationStatus } from '../enums/invitation-status.enum';

interface CancelInvitationProps {
  invitationId: string;
  workspaceId: string;
}

export class CancelInvitation {
  constructor(
    private readonly invitationRepository: WorkspaceInvitationRepository,
  ) {}

  async execute(props: CancelInvitationProps): Promise<void> {
    const invitation = await this.invitationRepository.findById(props.invitationId);
    // An invitation from another workspace is reported as missing, never touched
    if (!invitation || invitation.workspaceId !== props.workspaceId) {
      throw new EntityNotFoundError('Invitation not found');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new DomainValidationError('Only pending invitations can be cancelled');
    }

    invitation.cancel();
    await this.invitationRepository.update(invitation);
  }
}
