import { Query } from '../../../shared/domain/query';
import { NotificationRepository } from '../../domain/repositories/notification.repository';

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
  isRead: boolean;
  createdAt: Date | undefined;
}

export interface ListNotificationsResponse {
  unreadCount: number;
  notifications: NotificationListItem[];
}

export class ListNotificationsQuery implements Query<Props, ListNotificationsResponse> {
  constructor(private readonly repository: NotificationRepository) {}

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
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
    };
  }
}
