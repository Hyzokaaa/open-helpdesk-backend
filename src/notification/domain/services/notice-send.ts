import { IdGenerator } from '../../../shared/domain/id-generator';
import { EventPublisher } from '../../../shared/domain/event-publisher';
import { AuditLogRepository } from '../../../audit-log/domain/repositories/audit-log.repository';
import { RecordEmailSend } from '../../../audit-log/domain/services/audit-log-record-email-send';
import { EmailService, SendEmailResult } from '../../../email/domain/email.service';
import { NoticeTemplate } from '../../../email/templates/notice.template';
import { User } from '../../../user/domain/entities/user';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import { WorkspaceMemberRepository } from '../../../workspace/domain/repositories/workspace-member.repository';
import { Notification } from '../entities/notification';
import { NotificationPreference } from '../entities/notification-preference';
import { NoticePreference } from '../entities/notice-preference';
import { MATRIX_STANDALONE_NOTICE_EVENT, MatrixStandaloneNoticeEvent } from '../matrix-personal-notice';
import { NoticeCatalog, isMandatory, isNoticeChannelOn } from '../notice-catalog';
import { NoticeChannel, NoticeData, NoticeKind, NoticeLang, noticeLang, noticeText } from '../notice-kind';
import { NotificationRepository } from '../repositories/notification.repository';
import { NotificationPreferenceRepository } from '../repositories/notification-preference.repository';
import { NoticePreferenceRepository } from '../repositories/notice-preference.repository';

export interface SendNoticeProps {
  /** A NoticeKind's key. */
  kind: string;
  /** The workspace it is about; its admins hear of it when the kind is for them. */
  workspace: { id: string; slug: string } | null;
  /** Whom it goes to, when the kind's audience is 'given'. */
  userIds?: string[];
  /** Never to them: whoever caused it already knows. */
  exclude?: string[];
  data: NoticeData;
  /** The page it opens, from the app's root ("/dashboard/…"). */
  path: string;
}

/** The users told on each channel. */
export interface SentNotice {
  inApp: string[];
  email: string[];
  matrix: string[];
}

/** What sends a notice: the core's listeners and an extension (cloud) depend on this, never on how it goes out. */
export interface NoticeSender {
  send(props: SendNoticeProps): Promise<SentNotice>;
}

/**
 * Tells a notice that is not about a ticket to the people its kind is for, on each channel they
 * want it by (or must get it by): in the app, by email (from the installation's sender, one
 * email per person) and on Matrix, in each one's language.
 */
export class SendNotice {
  constructor(
    private readonly catalog: NoticeCatalog,
    private readonly idGenerator: IdGenerator,
    private readonly notificationRepository: NotificationRepository,
    private readonly preferenceRepository: NotificationPreferenceRepository,
    private readonly noticePreferenceRepository: NoticePreferenceRepository,
    private readonly userRepository: UserRepository,
    private readonly memberRepository: WorkspaceMemberRepository,
    private readonly emailService: EmailService,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly events: EventPublisher,
    /** The app's address for a workspace (its own domain, if it has one), or the installation's. */
    private readonly frontendUrl: (workspaceId: string | null) => Promise<string>,
  ) {}

  async execute(props: SendNoticeProps): Promise<SentNotice> {
    const sent: SentNotice = { inApp: [], email: [], matrix: [] };
    const kind = this.catalog.get(props.kind);
    if (!kind) throw new Error(`Unknown notice kind "${props.kind}"`);

    const excluded = new Set(props.exclude ?? []);
    const users = (await this.audience(kind, props)).filter((u) => u.isActive && !excluded.has(u.getId()));
    if (users.length === 0) return sent;

    const ids = users.map((u) => u.getId());
    const [general, chosen] = await Promise.all([
      this.preferenceRepository.findByUserIds(ids),
      this.noticePreferenceRepository.findByUserIds(ids),
    ]);
    const wants = (user: User, channel: NoticeChannel) => this.wants(kind, channel, general.get(user.getId()), chosen.filter((p) => p.userId === user.getId()));

    for (const user of users.filter((u) => wants(u, 'inApp'))) {
      await this.notificationRepository.create(new Notification({
        id: this.idGenerator.create(),
        userId: user.getId(),
        type: kind.key,
        title: noticeText(kind.headline, noticeLang(user.language), props.data),
        ticketId: null,
        workspaceSlug: props.workspace?.slug ?? '',
        link: props.path,
        isRead: false,
      }));
      sent.inApp.push(user.getId());
    }

    const url = `${await this.frontendUrl(props.workspace?.id ?? null)}${props.path}`;
    for (const user of users.filter((u) => wants(u, 'email'))) {
      await this.email(kind, user, noticeLang(user.language), props, url);
      sent.email.push(user.getId());
    }

    sent.matrix = users.filter((u) => wants(u, 'matrix')).map((u) => u.getId());
    if (sent.matrix.length > 0) {
      const event: MatrixStandaloneNoticeEvent = {
        kind: kind.key,
        userIds: sent.matrix,
        workspaceId: props.workspace?.id ?? null,
        icon: kind.icon,
        headline: { en: noticeText(kind.headline, 'en', props.data), es: noticeText(kind.headline, 'es', props.data) },
        action: kind.action,
        path: props.path,
      };
      this.events.emit(MATRIX_STANDALONE_NOTICE_EVENT, event);
    }
    return sent;
  }

  private async audience(kind: NoticeKind, props: SendNoticeProps): Promise<User[]> {
    switch (kind.audience) {
      case 'workspace-admins': {
        if (!props.workspace) throw new Error(`Notice kind "${kind.key}" needs a workspace`);
        const members = await this.memberRepository.findByWorkspaceId(props.workspace.id);
        const ids = members.filter((m) => m.role === WorkspaceRole.ADMIN).map((m) => m.userId);
        return ids.length > 0 ? this.userRepository.findByIds(ids) : [];
      }
      case 'system-admins':
        return (await this.userRepository.findAll()).filter((u) => u.isSystemAdmin);
      case 'given':
        return props.userIds?.length ? this.userRepository.findByIds(props.userIds) : [];
    }
  }

  /**
   * What the person chose for this kind and channel, else the kind's default, within the channel's
   * general switch. A mandatory channel goes whatever they chose, except Matrix, which they must
   * have set up and turned on.
   */
  private wants(kind: NoticeKind, channel: NoticeChannel, general: NotificationPreference | undefined, chosen: NoticePreference[]): boolean {
    if (channel === 'matrix' && !general?.matrixEnabled) return false;
    if (isMandatory(kind, channel)) return true;
    if (channel === 'inApp' && general && !general.inAppEnabled) return false;
    if (channel === 'email' && general && !general.emailEnabled) return false;
    return isNoticeChannelOn(kind, channel, chosen);
  }

  private async email(kind: NoticeKind, user: User, lang: NoticeLang, props: SendNoticeProps, url: string): Promise<void> {
    const template = new NoticeTemplate();
    const data = {
      lang,
      headline: noticeText(kind.headline, lang, props.data),
      action: noticeText(kind.action, lang, props.data),
      url,
      mandatory: isMandatory(kind, 'email'),
    };
    const subject = template.subject(data);
    const result: SendEmailResult = await this.emailService
      .send({ to: [user.email], subject, html: template.html(data) })
      .catch((error: Error) => ({ success: false, error: error.message }));
    await new RecordEmailSend(this.idGenerator, this.auditLogRepository).execute({
      result,
      type: 'notice',
      to: [user.email],
      subject,
      workspaceId: props.workspace?.id ?? null,
      entityType: 'notice',
      entityId: kind.key,
    });
  }
}
