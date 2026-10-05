import { DomainValidationError } from '../../../shared/domain/errors';
import { WorkspaceMemberRepository } from '../../../workspace/domain/repositories/workspace-member.repository';
import { PERMISSIONS, hasPermission } from '../../../workspace/domain/permissions';

interface Props {
  workspaceId: string;
  userId: string;
}

/**
 * Who may hold a ticket: a member of the workspace whose role can pick tickets up
 * (admins, supervisors and agents). Assigning or transferring to anyone else is refused,
 * so an id from another workspace, or a plain user, never becomes an assignee.
 */
export class EnsureTicketAssignee {
  constructor(private readonly memberRepository: WorkspaceMemberRepository) {}

  async execute(props: Props): Promise<void> {
    const member = await this.memberRepository.findByWorkspaceAndUser(props.workspaceId, props.userId);
    if (!member || !hasPermission(member.role, PERMISSIONS.TICKET_PICKUP)) {
      throw new DomainValidationError('Assignee must be an agent of this workspace');
    }
  }
}
