import { ConflictException } from '@nestjs/common';
import { IdGenerator } from '../../../shared/domain/id-generator';
import { WorkspaceMember } from '../entities/workspace-member';
import { WorkspaceRole } from '../enums/workspace-role.enum';
import { WorkspaceMemberRepository } from '../repositories/workspace-member.repository';

interface AddMemberProps {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}

export class AddWorkspaceMember {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: WorkspaceMemberRepository,
  ) {}

  async execute(props: AddMemberProps): Promise<WorkspaceMember> {
    const existing = await this.repository.findByWorkspaceAndUser(
      props.workspaceId,
      props.userId,
    );
    if (existing) {
      throw new ConflictException('User is already a member of this workspace');
    }

    const member = new WorkspaceMember({
      id: this.idGenerator.create(),
      workspaceId: props.workspaceId,
      userId: props.userId,
      role: props.role,
    });

    await this.repository.create(member);
    return member;
  }
}
