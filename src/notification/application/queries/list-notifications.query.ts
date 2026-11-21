import { Query } from '../../../shared/domain/query';
import { NotificationRepository } from '../../domain/repositories/notification.repository';
import { NoticeCatalog } from '../../domain/notice-catalog';
import { NoticeText } from '../../domain/notice-kind';

interface Props {
  userId: string;
  unreadOnly: boolean;
}

export interface NotificationListItem {
  id: string;
  type: string;
  title: string;
  ticketId: string | null;
  workspaceSlug: string;
  /** Where it takes you, for a notice that is not about a ticket. */
  link: string | null;
  /** The name of a catalogued kind (an extension's too), which the client cannot know. */
  label: NoticeText | null;
  isRead: boolean;
  createdAt: Date | undefined;
}

export interface ListNotificationsResponse {
  unreadCount: number;
  notifications: NotificationListItem[];
}

export class ListNotificationsQuery implements Query<Props, ListNotificationsResponse> {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly catalog: NoticeCatalog,
  ) {}

  async execute(props: Props): Promise<ListNotificationsResponse> {
    const [notifications, unreadCount] = await Promise.all([
      this.repository.findByUserId(props.userId, props.unreadOnly),
      this.repository.countUnread(props.userId),
    ]);

    return {
      unreadCount,
      notifications: notifications.map((n) => ({
        id: n.getId(),
        type: n.type,
        title: n.title,
        ticketId: n.ticketId,
        workspaceSlug: n.workspaceSlug,
        link: n.link,
        label: this.catalog.get(n.type)?.label ?? null,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
    };
  }
}
