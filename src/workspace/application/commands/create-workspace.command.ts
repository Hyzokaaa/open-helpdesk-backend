import { Command } from '../../../shared/domain/command';
import { CreateWorkspace } from '../../domain/services/workspace-create';
import { AddWorkspaceMember } from '../../domain/services/workspace-add-member';
import { WorkspaceRole } from '../../domain/enums/workspace-role.enum';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { CreateMailbox } from '../../../mailbox/domain/services/mailbox-create';

interface Props {
  name: string;
  description: string;
  creatorUserId: string;
  accountId?: string;
  supportEmailDomain?: string;
}

export interface CreateWorkspaceResponse {
  id: string;
  name: string;
  slug: string;
}

export class CreateWorkspaceCommand implements Command<Props, CreateWorkspaceResponse> {
  constructor(
    private readonly createWorkspace: CreateWorkspace,
    private readonly addMember: AddWorkspaceMember,
    private readonly createAuditLog: CreateAuditLogEntry,
    private readonly createMailbox?: CreateMailbox,
  ) {}

  async execute(props: Props): Promise<CreateWorkspaceResponse> {
    const workspace = await this.createWorkspace.execute({
      name: props.name,
      description: props.description,
      accountId: props.accountId,
    });

    await this.addMember.execute({
      workspaceId: workspace.getId(),
      userId: props.creatorUserId,
      role: WorkspaceRole.ADMIN,
    });

    if (this.createMailbox && props.supportEmailDomain) {
      await this.createMailbox.execute({
        workspaceSlug: workspace.slug,
        workspaceId: workspace.getId(),
        emailDomain: props.supportEmailDomain,
      });
    }

    await this.createAuditLog.execute({
      action: AuditAction.WORKSPACE_CREATED,
      entityType: 'workspace',
      entityId: workspace.getId(),
      userId: props.creatorUserId,
      workspaceId: workspace.getId(),
      metadata: { name: workspace.name, slug: workspace.slug },
    });

    return { id: workspace.getId(), name: workspace.name, slug: workspace.slug };
  }
}
