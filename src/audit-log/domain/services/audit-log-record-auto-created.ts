import { AuditAction } from '../enums/audit-action.enum';
import { AuditCategory } from '../enums/audit-category.enum';
import { AuditLevel } from '../enums/audit-level.enum';
import { CreateAuditLogEntry } from './audit-log-create';

/** What created the account or the membership without anyone adding it by hand. */
export type AutoCreatedVia = 'on-behalf' | 'inbound-email' | 'portal' | 'oauth';

interface Props {
  via: AutoCreatedVia;
  user: { id: string; email: string };
  /** The account did not exist before. */
  userCreated: boolean;
  /** The membership created in the workspace, if any. */
  member?: { id: string; role: string } | null;
  workspaceId: string | null;
  /** Who caused it, when someone did (an agent filing on behalf); null for a customer writing in. */
  actorUserId: string | null;
  source: string;
}

/**
 * Accounts and memberships also appear as a side effect: a ticket filed on someone's behalf, an
 * email or a portal ticket from a new address, a first sign-in with Google. Each is recorded like
 * one created by hand, marked with how it came to be.
 */
export class RecordAutoCreated {
  constructor(private readonly createEntry: CreateAuditLogEntry) {}

  async execute(props: Props): Promise<void> {
    if (props.userCreated) {
      await this.createEntry.execute({
        action: AuditAction.USER_CREATED,
        entityType: 'user',
        entityId: props.user.id,
        userId: props.actorUserId,
        workspaceId: props.workspaceId,
        metadata: { email: props.user.email, autoCreated: true, via: props.via },
        category: AuditCategory.USER,
        level: AuditLevel.INFO,
        source: props.source,
      });
    }
    if (props.member && props.workspaceId) {
      await this.createEntry.execute({
        action: AuditAction.MEMBER_ADDED,
        entityType: 'workspace-member',
        entityId: props.member.id,
        userId: props.actorUserId,
        workspaceId: props.workspaceId,
        metadata: { target: props.user.email, role: props.member.role, autoCreated: true, via: props.via },
        category: AuditCategory.WORKSPACE,
        level: AuditLevel.INFO,
        source: props.source,
      });
    }
  }
}
