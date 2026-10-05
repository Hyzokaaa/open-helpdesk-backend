import { Command } from '../../../shared/domain/command';
import { EntityNotFoundError } from '../../../shared/domain/errors';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { WorkspaceRepository } from '../../../workspace/domain/repositories/workspace.repository';
import { PERMISSIONS } from '../../../workspace/domain/permissions';
import { ImproveText } from '../../domain/services/improve-text';
import { AiUsageRepository } from '../../domain/repositories/ai-usage.repository';
import { currentUsageMonth } from '../../domain/usage-month';

interface Props {
  workspaceSlug: string;
  userId: string;
  isSystemAdmin: boolean;
  text: string;
  language?: string;
}

export interface ImproveTextResponse {
  result: string;
}

export class ImproveTextCommand implements Command<Props, ImproveTextResponse> {
  constructor(
    private readonly improveText: ImproveText,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly aiUsageRepository: AiUsageRepository,
  ) {}

  async execute(props: Props): Promise<ImproveTextResponse> {
    // The workspace pays for the call (quota, and in SaaS the plan limit), so the caller must belong to it
    const workspace = await this.workspaceRepository.findBySlug(props.workspaceSlug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    await this.ensurePermission.execute({
      workspaceId: workspace.getId(),
      userId: props.userId,
      permission: PERMISSIONS.COMMENT_CREATE,
      isSystemAdmin: props.isSystemAdmin,
    });

    const result = await this.improveText.execute({ text: props.text, language: props.language });
    // Usage stays keyed by slug: the SaaS plan-limit guard reads it that way
    this.aiUsageRepository.increment(workspace.slug, currentUsageMonth()).catch(() => {});
    return { result };
  }
}
