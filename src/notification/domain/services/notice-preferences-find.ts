import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import { WorkspaceMemberRepository } from '../../../workspace/domain/repositories/workspace-member.repository';
import { NoticeCatalog, isMandatory, isNoticeChannelOn } from '../notice-catalog';
import { NOTICE_CHANNELS, NoticeChannel, NoticeKind, NoticeText } from '../notice-kind';
import { NoticePreferenceRepository } from '../repositories/notice-preference.repository';

export interface NoticeSetting {
  key: string;
  label: NoticeText;
  description: NoticeText;
  channels: Record<NoticeChannel, { enabled: boolean; mandatory: boolean }>;
}

/**
 * The kinds of notice a person can get, with what they chose on each channel (or the default):
 * the workspace admins' kinds to whoever administers a workspace, the installation's to its
 * admins, and those sent to named people to anyone on a team.
 */
export class FindNoticePreferences {
  constructor(
    private readonly catalog: NoticeCatalog,
    private readonly preferenceRepository: NoticePreferenceRepository,
    private readonly memberRepository: WorkspaceMemberRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(userId: string): Promise<NoticeSetting[]> {
    const user = await this.userRepository.findById(userId);
    if (!user) return [];
    const roles = new Set((await this.memberRepository.findByUserId(userId)).map((m) => m.role));
    const applies = (kind: NoticeKind) => {
      switch (kind.audience) {
        case 'workspace-admins': return roles.has(WorkspaceRole.ADMIN);
        case 'system-admins': return user.isSystemAdmin;
        case 'given': return user.isSystemAdmin || [...roles].some((r) => r !== WorkspaceRole.USER);
      }
    };

    const chosen = await this.preferenceRepository.findByUserIds([userId]);
    return this.catalog.all().filter(applies).map((kind) => ({
      key: kind.key,
      label: kind.label,
      description: kind.description,
      channels: Object.fromEntries(NOTICE_CHANNELS.map((channel) => [
        channel,
        { enabled: isNoticeChannelOn(kind, channel, chosen), mandatory: isMandatory(kind, channel) },
      ])) as NoticeSetting['channels'],
    }));
  }
}
