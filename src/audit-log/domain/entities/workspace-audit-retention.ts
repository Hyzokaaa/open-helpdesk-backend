import { RetentionDays } from '../audit-retention';

interface Props {
  workspaceId: string;
  days?: RetentionDays;
}

/** The days a workspace has set for itself, per category (null: forever); unset ones follow the installation. */
export class WorkspaceAuditRetention {
  workspaceId: string;
  days: RetentionDays;

  constructor(props: Props) {
    this.workspaceId = props.workspaceId;
    this.days = props.days ?? {};
  }
}
