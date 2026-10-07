import { RetentionDays } from '../audit-retention';

interface Props {
  workspaceId: string;
  days?: RetentionDays;
}

/** What a workspace keeps longer than the installation, per category (null: forever). */
export class WorkspaceAuditRetention {
  workspaceId: string;
  days: RetentionDays;

  constructor(props: Props) {
    this.workspaceId = props.workspaceId;
    this.days = props.days ?? {};
  }
}
