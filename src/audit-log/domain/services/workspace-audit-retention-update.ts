import { AuditRetentionSettings } from '../entities/audit-retention-settings';
import { WorkspaceAuditRetention } from '../entities/workspace-audit-retention';
import { WorkspaceAuditRetentionRepository } from '../repositories/workspace-audit-retention.repository';
import { normalizeWorkspaceRetention, RetentionDays } from '../audit-retention';

interface Props {
  workspaceId: string;
  /** The categories being set; the ones left out keep what the workspace had. */
  days: unknown;
  installation: AuditRetentionSettings;
}

/**
 * Sets the categories a workspace keeps for itself, merged into what it already had: a category it
 * never set follows the installation, and one it set keeps its days whatever the installation does.
 */
export class UpdateWorkspaceAuditRetention {
  constructor(private readonly repository: WorkspaceAuditRetentionRepository) {}

  async execute(props: Props): Promise<{ retention: WorkspaceAuditRetention; before: RetentionDays; after: RetentionDays }> {
    const current = (await this.repository.findByWorkspaceId(props.workspaceId)) ?? new WorkspaceAuditRetention({ workspaceId: props.workspaceId });
    const before = { ...current.days };
    current.days = { ...current.days, ...normalizeWorkspaceRetention(props.days, props.installation.days) };
    await this.repository.save(current);
    return { retention: current, before, after: { ...current.days } };
  }
}
