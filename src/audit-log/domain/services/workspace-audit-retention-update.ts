import { AuditRetentionSettings } from '../entities/audit-retention-settings';
import { WorkspaceAuditRetention } from '../entities/workspace-audit-retention';
import { WorkspaceAuditRetentionRepository } from '../repositories/workspace-audit-retention.repository';
import { normalizeWorkspaceRetention, RetentionDays } from '../audit-retention';

interface Props {
  workspaceId: string;
  /** The categories the workspace keeps longer; any left out follow the installation. */
  days: unknown;
  installation: AuditRetentionSettings;
}

/** Sets how much longer than the installation a workspace keeps its audit history. */
export class UpdateWorkspaceAuditRetention {
  constructor(private readonly repository: WorkspaceAuditRetentionRepository) {}

  async execute(props: Props): Promise<{ retention: WorkspaceAuditRetention; before: RetentionDays; after: RetentionDays }> {
    const current = (await this.repository.findByWorkspaceId(props.workspaceId)) ?? new WorkspaceAuditRetention({ workspaceId: props.workspaceId });
    const before = { ...current.days };
    current.days = normalizeWorkspaceRetention(props.days, props.installation.days);
    await this.repository.save(current);
    return { retention: current, before, after: { ...current.days } };
  }
}
