import { Command } from '../../../shared/domain/command';
import { AddWorkspaceMember } from '../../domain/services/workspace-add-member';
import { WorkspaceRole } from '../../domain/enums/workspace-role.enum';

interface Props {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}

export interface AddMemberResponse {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}

export class AddMemberCommand implements Command<Props, AddMemberResponse> {
  constructor(private readonly addMember: AddWorkspaceMember) {}

  async execute(props: Props): Promise<AddMemberResponse> {
    const member = await this.addMember.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      role: props.role,
    });

    return {
      id: member.getId(),
      workspaceId: member.workspaceId,
      userId: member.userId,
      role: member.role,
    };
  }
}
