import { Command } from '../../../shared/domain/command';
import { EnsureWorkspacePermission } from '../../domain/services/workspace-ensure-permission';
import { ConfirmImportMembers } from '../../domain/services/workspace-import-members-confirm';
import { PERMISSIONS } from '../../domain/permissions';
import { WorkspaceRole } from '../../domain/enums/workspace-role.enum';

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
  ) {}

  async execute(props: Props): Promise<ConfirmResult> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.requestingUserId,
      permission: PERMISSIONS.WORKSPACE_MEMBERS_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    return this.confirmImport.execute({
      workspaceId: props.workspaceId,
      rows: props.rows,
      skipVerification: props.skipVerification,
    });
  }
}
