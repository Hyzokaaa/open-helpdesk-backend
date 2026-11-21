import { User } from '../../../user/domain/entities/user';
import { WorkspaceMemberRepository } from '../../../workspace/domain/repositories/workspace-member.repository';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import { NotificationType } from '../enums/notification-type.enum';
import { DispatchNotifications } from './notification-dispatch';

interface Props {
  /** Everyone to tell of the comment: the ticket's people and anyone mentioned. */
  users: User[];
  mentionedUserIds: string[];
  authorName: string;
  ticketName: string;
  ticketId: string;
  workspaceId: string;
  workspaceSlug: string;
}

export interface CommentDispatched {
  /** Team members told "you were mentioned", and whom to email so. */
  mentioned: { users: User[]; emailRecipients: Map<string, string[]> };
  /** The comment notice, to everyone not already told of the mention on that channel. */
  comment: { users: User[]; emailRecipients: Map<string, string[]> };
}

/**
 * Tells of a new comment. A mentioned team member hears "you were mentioned" instead, on each channel
 * they want mentions on; on the others they get the comment as anyone would. Never both on one channel.
 * Customers are not told of mentions: they already hear of every comment on their ticket.
 */
export class DispatchCommentNotifications {
  constructor(
    private readonly dispatch: DispatchNotifications,
    private readonly memberRepository: WorkspaceMemberRepository,
  ) {}

  async execute(props: Props): Promise<CommentDispatched> {
    const mentionedIds = new Set(props.mentionedUserIds);
    const mentionedTeam: User[] = [];
    for (const user of props.users) {
      if (mentionedIds.has(user.getId()) && (await this.isTeam(props.workspaceId, user))) mentionedTeam.push(user);
    }

    const mention = await this.dispatch.execute({
      users: mentionedTeam,
      type: NotificationType.MENTIONED,
      title: `${props.authorName} mentioned you on ${props.ticketName}`,
      ticketId: props.ticketId,
      workspaceSlug: props.workspaceSlug,
      inAppPrefKey: 'inAppMentioned',
      emailPrefKey: 'emailMentioned',
      matrix: { prefKey: 'matrixMentioned', notice: { kind: 'mention', actorName: props.authorName } },
    });
    const comment = await this.dispatch.execute({
      users: props.users,
      skip: mention.notified,
      type: NotificationType.COMMENT_CREATED,
      title: `${props.authorName} on ${props.ticketName}`,
      ticketId: props.ticketId,
      workspaceSlug: props.workspaceSlug,
      inAppPrefKey: 'inAppCommentCreated',
      emailPrefKey: 'emailCommentCreated',
      matrix: { prefKey: 'matrixCommentCreated', notice: { kind: 'comment', actorName: props.authorName } },
    });
    return {
      mentioned: { users: mentionedTeam, emailRecipients: mention.emailRecipients },
      comment: { users: props.users, emailRecipients: comment.emailRecipients },
    };
  }

  private async isTeam(workspaceId: string, user: User): Promise<boolean> {
    const member = await this.memberRepository.findByWorkspaceAndUser(workspaceId, user.getId());
    return member ? member.role !== WorkspaceRole.USER : user.isSystemAdmin;
  }
}
