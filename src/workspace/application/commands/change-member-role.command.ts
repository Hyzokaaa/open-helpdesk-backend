import { Command } from '../../../shared/domain/command';
import { ChangeWorkspaceMemberRole } from '../../domain/services/workspace-change-member-role';
import { WorkspaceRole } from '../../domain/enums/workspace-role.enum';

interface Props {
  workspaceId: string;
  targetUserId: string;
  newRole: WorkspaceRole;
  requestingUserId: string;
  isSystemAdmin: boolean;
}

export interface ChangeMemberRoleResponse {
  userId: string;
  role: WorkspaceRole;
}

export class ChangeMemberRoleCommand implements Command<Props, ChangeMemberRoleResponse> {
  constructor(private readonly changeRole: ChangeWorkspaceMemberRole) {}

  async execute(props: Props): Promise<ChangeMemberRoleResponse> {
    const member = await this.changeRole.execute(props);
    return { userId: member.userId, role: member.role };
  }
}
