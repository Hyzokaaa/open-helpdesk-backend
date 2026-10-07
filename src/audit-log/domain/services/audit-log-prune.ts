import { AuditRetentionSettingsRepository } from '../repositories/audit-retention-settings.repository';
import { AuditLogPruner } from '../audit-log-pruner';

/** Small batches keep each delete short, so the log stays writable while it is pruned. */
const BATCH_SIZE = 5000;
/** A bound on one run, so a huge backlog is worked off over several nights, not one. */
const MAX_BATCHES_PER_CATEGORY = 200;

/**
 * Deletes the audit entries that outlived their retention, category by category. Does nothing
 * while retention is off. Returns how many entries it deleted per category.
 */
export class PruneAuditLog {
  constructor(
    private readonly settingsRepository: AuditRetentionSettingsRepository,
    private readonly pruner: AuditLogPruner,
  ) {}

  async execute(now: Date = new Date()): Promise<Record<string, number>> {
    const settings = await this.settingsRepository.find();
    if (!settings?.enabled) return {};

    const deleted: Record<string, number> = {};
    for (const [category, days] of Object.entries(settings.days)) {
      if (days === null) continue; // kept forever
      let total = 0;
      for (let batch = 0; batch < MAX_BATCHES_PER_CATEGORY; batch++) {
        const count = await this.pruner.pruneBatch(category, days, now, BATCH_SIZE);
        total += count;
        if (count < BATCH_SIZE) break;
      }
      if (total > 0) deleted[category] = total;
    }
    return deleted;
  }
}
