import { Command } from '../../../shared/domain/command';
import { EnsureWorkspacePermission } from '../../domain/services/workspace-ensure-permission';
import { ConfirmImportMembers } from '../../domain/services/workspace-import-members-confirm';
import { PERMISSIONS } from '../../domain/permissions';
import { WorkspaceRole } from '../../domain/enums/workspace-role.enum';
import { EventPublisher } from '../../../shared/domain/event-publisher';
import { WORKSPACE_MEMBERS_JOINED_EVENT, WorkspaceMembersJoinedEvent } from '../../../workspace/domain/workspace-member-events';

interface ImportRow {
  email: string;
  firstName: string;
  lastName: string;
  role: WorkspaceRole;
}

interface Props {
  workspaceId: string;
  rows: ImportRow[];
  skipVerification: boolean;
  requestingUserId: string;
  isSystemAdmin: boolean;
}

export interface ConfirmResult {
  created: number;
  added: number;
  skipped: number;
  createdUsers: Array<{ userId: string; email: string; firstName: string }>;
}

export class ImportMembersConfirmCommand implements Command<Props, ConfirmResult> {
  constructor(
    private readonly confirmImport: ConfirmImportMembers,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(props: Props): Promise<ConfirmResult> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.requestingUserId,
      permission: PERMISSIONS.WORKSPACE_MEMBERS_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    const { addedMembers, ...result } = await this.confirmImport.execute({
      workspaceId: props.workspaceId,
      rows: props.rows,
      skipVerification: props.skipVerification,
    });
    if (addedMembers.length > 0) {
      const joined: WorkspaceMembersJoinedEvent = { workspaceId: props.workspaceId, members: addedMembers, actorId: props.requestingUserId };
      this.eventPublisher.emit(WORKSPACE_MEMBERS_JOINED_EVENT, joined);
    }
    return result;
  }
}
