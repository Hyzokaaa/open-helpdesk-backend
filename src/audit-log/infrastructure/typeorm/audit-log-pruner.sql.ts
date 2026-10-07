import { DataSource } from 'typeorm';
import { AuditLogPruner } from '../../domain/audit-log-pruner';

/** An ISO date as the import writes it; anything else falls back to the entry's own date. */
const ISO_DATE = String.raw`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$`;

export class SqlAuditLogPruner implements AuditLogPruner {
  constructor(private readonly dataSource: DataSource) {}

  async pruneBatch(category: string, days: number, now: Date, batchSize: number): Promise<number> {
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    // An entry goes when it is older than the installation's retention, counted from its import
    // for imported ones, and its workspace (if any) does not keep that category longer or forever.
    // The plain createdAt bound comes first so the (category, createdAt) index does the work.
    const result: unknown = await this.dataSource.query(
      `WITH doomed AS (
         SELECT a.id
         FROM audit_log_entries a
         LEFT JOIN workspace_audit_retention w ON w."workspaceId" = a."workspaceId"
         WHERE a.category = $1
           AND a."createdAt" < $2
           AND (CASE WHEN a.metadata->'imported'->>'at' ~ '${ISO_DATE}'
                     THEN (a.metadata->'imported'->>'at')::timestamptz
                     ELSE a."createdAt" END) < $2
           AND (
             w."workspaceId" IS NULL
             OR NOT (w.days ? $1)
             OR (jsonb_typeof(w.days->$1) = 'number'
                 AND (CASE WHEN a.metadata->'imported'->>'at' ~ '${ISO_DATE}'
                           THEN (a.metadata->'imported'->>'at')::timestamptz
                           ELSE a."createdAt" END) < $3::timestamptz - make_interval(days => (w.days->>$1)::int))
           )
         LIMIT $4
       )
       DELETE FROM audit_log_entries WHERE id IN (SELECT id FROM doomed) RETURNING id`,
      [category, cutoff, now, batchSize],
    );
    // For a DELETE the Postgres driver answers [rows, rowCount]
    if (Array.isArray(result) && result.length === 2 && Array.isArray(result[0]) && typeof result[1] === 'number') return result[1];
    return Array.isArray(result) ? result.length : 0;
  }
}
