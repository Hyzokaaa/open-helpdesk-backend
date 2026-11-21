import { EntityNotFoundError, DomainValidationError } from '../../../shared/domain/errors';
import { WorkspaceInvitationRepository } from '../repositories/workspace-invitation.repository';
import { InvitationStatus } from '../enums/invitation-status.enum';

interface RejectInvitationProps {
  token: string;
  /** Who rejects it: only the person it was sent to may, as only they may accept it */
  userEmail: string;
}

export class RejectInvitation {
  constructor(
    private readonly invitationRepository: WorkspaceInvitationRepository,
  ) {}

  async execute(props: RejectInvitationProps): Promise<void> {
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

    invitation.reject();
    await this.invitationRepository.update(invitation);
  }
}
