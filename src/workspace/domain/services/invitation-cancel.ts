import { EntityNotFoundError, DomainValidationError } from '../../../shared/domain/errors';
import { WorkspaceInvitationRepository } from '../repositories/workspace-invitation.repository';
import { InvitationStatus } from '../enums/invitation-status.enum';

interface CancelInvitationProps {
  invitationId: string;
}

export class CancelInvitation {
  constructor(
    private readonly invitationRepository: WorkspaceInvitationRepository,
  ) {}

  async execute(props: CancelInvitationProps): Promise<void> {
    const invitation = await this.invitationRepository.findById(props.invitationId);
    if (!invitation) {
      throw new EntityNotFoundError('Invitation not found');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new DomainValidationError('Only pending invitations can be cancelled');
    }

    invitation.cancel();
    await this.invitationRepository.update(invitation);
  }
}
