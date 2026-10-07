import { randomBytes } from 'crypto';
import { Command } from '../../../shared/domain/command';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { CreateUser } from '../../../user/domain/services/user-create';
import { WorkspaceMemberRepository } from '../../../workspace/domain/repositories/workspace-member.repository';
import { AddWorkspaceMember } from '../../../workspace/domain/services/workspace-add-member';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import { PERMISSIONS } from '../../../workspace/domain/permissions';
import { RecordAutoCreated } from '../../../audit-log/domain/services/audit-log-record-auto-created';

interface Props {
  email: string;
  workspaceId: string;
  /** Who is opening the ticket for someone else. */
  userId: string;
  isSystemAdmin: boolean;
}

export interface ResolveOnBehalfOfResponse {
  userId: string;
  email: string;
}

/**
 * Turns the "on behalf of" email into the reporter of a ticket, creating the account and
 * the workspace membership when they do not exist yet. Both are side effects anyone could
 * otherwise trigger for free, so the permission is checked before anything is touched.
 */
export class ResolveOnBehalfOfCommand implements Command<Props, ResolveOnBehalfOfResponse> {
  constructor(
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly userRepository: UserRepository,
    private readonly memberRepository: WorkspaceMemberRepository,
    private readonly createUser: CreateUser,
    private readonly addMember: AddWorkspaceMember,
    private readonly recordAutoCreated?: RecordAutoCreated,
  ) {}

  async execute(props: Props): Promise<ResolveOnBehalfOfResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.TICKET_CREATE_ON_BEHALF,
      isSystemAdmin: props.isSystemAdmin,
    });

    const email = props.email.trim().toLowerCase();
    let targetUser = await this.userRepository.findByEmail(email);
    const userCreated = !targetUser;

    if (!targetUser) {
      targetUser = await this.createUser.execute({
        email,
        password: randomBytes(32).toString('hex'),
        firstName: email.split('@')[0],
        lastName: '',
        isEmailVerified: true,
        autoCreated: true,
      });
    }

    const existingMember = await this.memberRepository.findByWorkspaceAndUser(props.workspaceId, targetUser.getId());
    const member = existingMember
      ? null
      : await this.addMember.execute({
          workspaceId: props.workspaceId,
          userId: targetUser.getId(),
          role: WorkspaceRole.USER,
        });

    await this.recordAutoCreated?.execute({
      via: 'on-behalf',
      user: { id: targetUser.getId(), email: targetUser.email },
      userCreated,
      member: member ? { id: member.getId(), role: member.role } : null,
      workspaceId: props.workspaceId,
      actorUserId: props.userId,
      source: 'ui',
    });

    return { userId: targetUser.getId(), email: targetUser.email };
  }
}
