import { IdGenerator } from '../../../shared/domain/id-generator';
import { AuditRetentionSettings } from '../entities/audit-retention-settings';
import { AuditRetentionSettingsRepository } from '../repositories/audit-retention-settings.repository';
import { normalizeInstallationRetention, RetentionDays } from '../audit-retention';

interface Props {
  enabled?: boolean;
  days?: unknown;
}

interface Snapshot {
  enabled: boolean;
  days: RetentionDays;
}

/** Turns the installation's retention on or off and sets its days per category. */
export class UpdateAuditRetentionSettings {
  constructor(
    private readonly repository: AuditRetentionSettingsRepository,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(props: Props): Promise<{ settings: AuditRetentionSettings; before: Snapshot; after: Snapshot }> {
    const current = (await this.repository.find()) ?? new AuditRetentionSettings({ id: this.idGenerator.create() });
    const before = { enabled: current.enabled, days: { ...current.days } };

    if (props.enabled !== undefined) current.enabled = props.enabled;
    if (props.days !== undefined) current.days = normalizeInstallationRetention(props.days, current.days);

    await this.repository.save(current);
    return { settings: current, before, after: { enabled: current.enabled, days: { ...current.days } } };
  }
}
