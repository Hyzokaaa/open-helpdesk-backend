import { DEFAULT_RETENTION_DAYS, RetentionDays } from '../audit-retention';

interface Props {
  id: string;
  enabled?: boolean;
  days?: RetentionDays;
}

/**
 * The installation's audit retention. Off until a system admin turns it on: an installation that
 * upgrades must not lose its history overnight because a default appeared.
 */
export class AuditRetentionSettings {
  id: string;
  enabled: boolean;
  days: RetentionDays;

  constructor(props: Props) {
    this.id = props.id;
    this.enabled = props.enabled ?? false;
    this.days = { ...DEFAULT_RETENTION_DAYS, ...(props.days ?? {}) };
  }
}
