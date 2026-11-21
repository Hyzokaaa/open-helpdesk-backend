import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import { WorkspaceRepository } from '../../../workspace/domain/repositories/workspace.repository';
import { WorkspaceMembersJoinedEvent } from '../../../workspace/domain/workspace-member-events';
import { MEMBER_JOINED_NOTICE } from '../core-notice-kinds';
import { NoticeLang, NoticeText } from '../notice-kind';
import { NoticeSender } from './notice-send';

/** Names listed in one notice; the rest are counted, so an import of hundreds is still one line. */
const NAMED = 3;
/** Those the link marks on the members page; past this the link would only grow, and the page lists them all anyway */
const MARKED = 50;

const ROLES: Partial<Record<WorkspaceRole, NoticeText>> = {
  [WorkspaceRole.ADMIN]: { en: 'admin', es: 'admin' },
  [WorkspaceRole.SUPERVISOR]: { en: 'supervisor', es: 'supervisor' },
  [WorkspaceRole.AGENT]: { en: 'agent', es: 'agente' },
};

const AND: NoticeText = { en: 'and', es: 'y' };
const JOINED_ONE: NoticeText = { en: 'joined', es: 'se unió' };
const JOINED_MANY: NoticeText = { en: 'joined', es: 'se unieron' };
const MORE: NoticeText = { en: '{count} more', es: '{count} más' };

/**
 * Tells a workspace's admins who joined its team, in one notice however many came in at once.
 * Customers are left out: they come in by writing, and would only be noise. Neither whoever
 * brought them in nor those who joined hear of it.
 */
export class SendMembersJoinedNotice {
  constructor(
    private readonly notices: NoticeSender,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(event: WorkspaceMembersJoinedEvent): Promise<void> {
    const team = event.members.filter((m) => m.role in ROLES);
    if (team.length === 0) return;
    const workspace = await this.workspaceRepository.findById(event.workspaceId);
    if (!workspace) return;

    const users = new Map((await this.userRepository.findByIds(team.map((m) => m.userId))).map((u) => [u.getId(), u]));
    const named = team.flatMap((m) => {
      const user = users.get(m.userId);
      return user ? [{ name: `${user.firstName} ${user.lastName}`.trim() || user.email, role: ROLES[m.role]! }] : [];
    });
    if (named.length === 0) return;

    const who = (lang: NoticeLang) => {
      const shown = named.slice(0, NAMED).map((n) => `${n.name} (${n.role[lang]})`);
      const rest = named.length - shown.length;
      if (rest > 0) shown.push(MORE[lang].replace('{count}', String(rest)));
      return shown.length === 1 ? shown[0] : `${shown.slice(0, -1).join(', ')} ${AND[lang]} ${shown[shown.length - 1]}`;
    };

    await this.notices.send({
      kind: MEMBER_JOINED_NOTICE.key,
      workspace: { id: workspace.getId(), slug: workspace.slug },
      exclude: [...(event.actorId ? [event.actorId] : []), ...team.map((m) => m.userId)],
      data: { workspace: workspace.name, who: { en: who('en'), es: who('es') }, joined: named.length === 1 ? JOINED_ONE : JOINED_MANY },
      path: `/dashboard/workspaces/${workspace.slug}/members?joined=${team.slice(0, MARKED).map((m) => m.userId).join(',')}`,
    });
  }
}
