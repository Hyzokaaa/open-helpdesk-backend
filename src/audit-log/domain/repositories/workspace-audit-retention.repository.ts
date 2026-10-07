import { WorkspaceAuditRetention } from '../entities/workspace-audit-retention';

export interface WorkspaceAuditRetentionRepository {
  findByWorkspaceId(workspaceId: string): Promise<WorkspaceAuditRetention | null>;
  save(retention: WorkspaceAuditRetention): Promise<void>;
}
