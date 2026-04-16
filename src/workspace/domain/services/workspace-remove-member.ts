import { BadRequestException, NotFoundException } from '@nestjs/common';
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
      throw new NotFoundException('Member not found in this workspace');
    }

    const members = await this.repository.findByWorkspaceId(props.workspaceId);
    if (members.length <= 1) {
      throw new BadRequestException(
        'Cannot remove the last member of a workspace',
      );
    }

    await this.repository.delete(member.getId());
  }
}
