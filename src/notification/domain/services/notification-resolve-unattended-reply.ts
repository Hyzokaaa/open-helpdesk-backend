import { User } from '../../../user/domain/entities/user';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { TicketRepository } from '../../../ticket/domain/repositories/ticket.repository';
import { TicketParticipantRepository } from '../../../ticket/domain/repositories/ticket-participant.repository';
import { WorkspaceMemberRepository } from '../../../workspace/domain/repositories/workspace-member.repository';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import { ResolveWorkspaceAdmins } from './notification-resolve-workspace-admins';

interface Props {
  ticketId: string;
  workspaceId: string;
  /** Who wrote the comment. */
  authorId: string;
}

const TEAM_ROLES = new Set<WorkspaceRole>([WorkspaceRole.ADMIN, WorkspaceRole.SUPERVISOR, WorkspaceRole.AGENT]);

/**
 * Who to alert when a customer answers a ticket nobody on the team looks after: no assignee, and
 * no team member reported or follows it. The workspace's admins and supervisors are told, as for
 * a new ticket, so the answer does not wait unseen in the queue.
 *
 * Empty in every other case: the author is on the team, the ticket has an owner, or someone on
 * the team already receives the comment as a follower.
 */
export class ResolveUnattendedReplyRecipients {
  constructor(
    private readonly ticketRepository: TicketRepository,
    private readonly participantRepository: TicketParticipantRepository,
    private readonly memberRepository: WorkspaceMemberRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(props: Props): Promise<User[]> {
    const ticket = await this.ticketRepository.findById(props.ticketId);
    if (!ticket || ticket.workspaceId !== props.workspaceId || ticket.assigneeId) return [];

    if (await this.isTeam(props.workspaceId, props.authorId)) return [];

    const participants = await this.participantRepository.findByTicketId(props.ticketId);
    const watchers = [ticket.reporterId, ...participants.map((p) => p.userId)];
    for (const userId of watchers) {
      if (await this.isTeam(props.workspaceId, userId)) return [];
    }

    return new ResolveWorkspaceAdmins(this.memberRepository, this.userRepository).execute({ workspaceId: props.workspaceId });
  }

  private async isTeam(workspaceId: string, userId: string): Promise<boolean> {
    const member = await this.memberRepository.findByWorkspaceAndUser(workspaceId, userId);
    if (member) return TEAM_ROLES.has(member.role);
    // A system admin need not be a member, and is never a customer
    const user = await this.userRepository.findById(userId);
    return !!user?.isSystemAdmin;
  }
}
