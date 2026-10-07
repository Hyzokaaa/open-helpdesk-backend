import { DataSource } from 'typeorm';
import { WorkspaceFileKeys } from '../../domain/workspace-file-keys';

/** Reads the storage keys of a workspace's files straight from the tables that hold them. */
export class SqlWorkspaceFileKeys implements WorkspaceFileKeys {
  constructor(private readonly dataSource: DataSource) {}

  async listFor(workspaceId: string): Promise<string[]> {
    // Every attachment records its ticket, also a comment's; deleted tickets still hold files
    const rows: { key: string }[] = await this.dataSource.query(
      `SELECT a."s3Key" AS key FROM attachments a JOIN tickets t ON t.id = a."ticketId" WHERE t."workspaceId" = $1
       UNION ALL
       SELECT o.logo AS key FROM organizations o WHERE o."workspaceId" = $1 AND o.logo IS NOT NULL`,
      [workspaceId],
    );
    return rows.map((r) => r.key).filter((k) => !!k);
  }
}
