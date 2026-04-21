import { DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { WorkspaceMemberRepository } from '../repositories/workspace-member.repository';

interface RemoveMemberProps {
  workspaceId: string;
  userId: string;
}

export class RemoveWorkspaceMember {
  constructor(
    private readonly repository: WorkspaceMemberRepository,
  ) {}

  async execute(props: RemoveMemberProps): Promise<void> {
    const member = await this.repository.findByWorkspaceAndUser(
      props.workspaceId,
      props.userId,
    );
    if (!member) {
      throw new EntityNotFoundError('Member not found in this workspace');
    }

    const members = await this.repository.findByWorkspaceId(props.workspaceId);
    if (members.length <= 1) {
      throw new DomainValidationError(
        'Cannot remove the last member of a workspace',
      );
    }

    await this.repository.delete(member.getId());
  }
}
