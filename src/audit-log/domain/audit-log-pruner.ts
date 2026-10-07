/**
 * Deletes the entries of one category older than its retention, honouring workspaces that keep
 * theirs longer. Imported entries count from the day they were imported, not the day they record.
 */
export interface AuditLogPruner {
  /** Deletes up to `batchSize` entries and says how many it deleted. */
  pruneBatch(category: string, days: number, now: Date, batchSize: number): Promise<number>;
}
