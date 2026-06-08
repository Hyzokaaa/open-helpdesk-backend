import { Command } from '../../../shared/domain/command';
import { EnsureWorkspacePermission } from '../../domain/services/workspace-ensure-permission';
import { ParseImportCsv, ImportPreview } from '../../domain/services/workspace-import-members-parse';
import { PERMISSIONS } from '../../domain/permissions';

interface Props {
  workspaceId: string;
  csv: string;
  requestingUserId: string;
  isSystemAdmin: boolean;
}

export class ImportMembersPreviewCommand implements Command<Props, ImportPreview> {
  constructor(
    private readonly parseImportCsv: ParseImportCsv,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<ImportPreview> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.requestingUserId,
      permission: PERMISSIONS.WORKSPACE_MEMBERS_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    return this.parseImportCsv.execute({
      csv: props.csv,
      workspaceId: props.workspaceId,
    });
  }
}
