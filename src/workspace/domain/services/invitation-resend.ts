import { randomUUID } from 'crypto';
import { EntityNotFoundError, DomainValidationError } from '../../../shared/domain/errors';
import { WorkspaceInvitationRepository } from '../repositories/workspace-invitation.repository';
import { WorkspaceInvitation } from '../entities/workspace-invitation';
import { InvitationStatus } from '../enums/invitation-status.enum';

interface ResendInvitationProps {
  invitationId: string;
}

export class ResendInvitation {
  constructor(
    private readonly invitationRepository: WorkspaceInvitationRepository,
  ) {}

  async execute(props: ResendInvitationProps): Promise<WorkspaceInvitation> {
    const invitation = await this.invitationRepository.findById(props.invitationId);
    if (!invitation) {
      throw new EntityNotFoundError('Invitation not found');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new DomainValidationError('Only pending invitations can be resent');
    }

    invitation.token = randomUUID();
    invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.invitationRepository.update(invitation);
    return invitation;
  }
}
