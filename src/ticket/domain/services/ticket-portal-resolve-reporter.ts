import { randomBytes } from 'crypto';
import { User } from '../../../user/domain/entities/user';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { CreateUser } from '../../../user/domain/services/user-create';
import { WorkspaceMemberRepository } from '../../../workspace/domain/repositories/workspace-member.repository';
import { AddWorkspaceMember } from '../../../workspace/domain/services/workspace-add-member';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';

interface Props {
  workspaceId: string;
  email: string;
  name: string;
}

export interface PortalReporter {
  user: User;
  /** Whether the reporter belongs to the workspace after this call. */
  isMember: boolean;
  /**
   * Whether the anonymous submitter may be handed the ticket's portal link directly. Only when
   * this request created the account: for an address that already had one, anyone could have
   * typed it, so the link (which lets its holder read and comment as the reporter) goes only to
   * that inbox, in the confirmation email.
   */
  mayRevealPortalLink: boolean;
}

/**
 * Decides who an anonymous portal ticket is filed for. The portal never proves who is typing,
 * so an address that already belongs to an account must not gain anything from the request:
 * it is not added to the workspace, and the submitter does not get the link to act as them.
 */
export class ResolvePortalReporter {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly memberRepository: WorkspaceMemberRepository,
    private readonly createUser: CreateUser,
    private readonly addMember: AddWorkspaceMember,
  ) {}

  async execute(props: Props): Promise<PortalReporter> {
    const existing = await this.userRepository.findByEmail(props.email);

    if (existing) {
      // Like a customer writing in by email, an existing account joins the workspace as a USER.
      // The anonymous submitter still never gets the portal link: that goes only to the inbox.
      const member = await this.memberRepository.findByWorkspaceAndUser(props.workspaceId, existing.getId());
      if (!member) {
        await this.addMember.execute({ workspaceId: props.workspaceId, userId: existing.getId(), role: WorkspaceRole.USER });
      }
      return { user: existing, isMember: true, mayRevealPortalLink: false };
    }

    const user = await this.createUser.execute({
      email: props.email,
      password: randomBytes(32).toString('hex'),
      firstName: props.name,
      lastName: '',
      isEmailVerified: false,
      autoCreated: true,
    });
    await this.addMember.execute({ workspaceId: props.workspaceId, userId: user.getId(), role: WorkspaceRole.USER });
    return { user, isMember: true, mayRevealPortalLink: true };
  }
}
