import { AccessDeniedError } from '../../../shared/domain/errors';
import { IdGenerator } from '../../../shared/domain/id-generator';
import { PasswordHasher } from '../../../shared/domain/password-hasher';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import { WorkspaceMemberRepository } from '../../../workspace/domain/repositories/workspace-member.repository';
import { User } from '../entities/user';
import { UserRepository } from '../repositories/user.repository';

interface ExchangeTokenProps {
  email: string;
  firstName: string;
  lastName: string;
  /** The workspace of the API key making the exchange. */
  workspaceId: string;
  /** Role for a user the exchange creates; an existing member keeps theirs. */
  role: WorkspaceRole;
  /** Whether the key may also act for supervisors and admins of its workspace. */
  allowElevatedRoles: boolean;
}

const ELEVATED_ROLES: WorkspaceRole[] = [WorkspaceRole.ADMIN, WorkspaceRole.SUPERVISOR];

/**
 * Resolves the user an integration signs in. An integration acts only within its own
 * workspace: an existing account must already be a member there, and system admins,
 * deactivated users and members of other workspaces are out of reach. Supervisors and
 * admins need the key to be explicitly allowed to act for them.
 */
export class ExchangeToken {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly memberRepository: WorkspaceMemberRepository,
  ) {}

  async execute(props: ExchangeTokenProps): Promise<User> {
    const existing = await this.repository.findByEmail(props.email);
    if (existing) {
      if (!existing.isActive || existing.isSystemAdmin) {
        throw new AccessDeniedError('This integration cannot sign in this user');
      }
      const member = await this.memberRepository.findByWorkspaceAndUser(props.workspaceId, existing.getId());
      if (!member) {
        throw new AccessDeniedError('This user does not belong to the workspace of this API key');
      }
      if (ELEVATED_ROLES.includes(member.role) && !props.allowElevatedRoles) {
        throw new AccessDeniedError('This API key cannot sign in supervisors or admins');
      }

      if (existing.firstName !== props.firstName || existing.lastName !== props.lastName) {
        existing.firstName = props.firstName;
        existing.lastName = props.lastName;
        await this.repository.update(existing);
      }
      return existing;
    }

    if (ELEVATED_ROLES.includes(props.role) && !props.allowElevatedRoles) {
      throw new AccessDeniedError('This API key cannot create supervisors or admins');
    }

    const randomPassword = this.idGenerator.create() + this.idGenerator.create();
    const hashedPassword = await this.passwordHasher.hash(randomPassword);

    const user = new User({
      id: this.idGenerator.create(),
      email: props.email,
      password: hashedPassword,
      firstName: props.firstName,
      lastName: props.lastName,
      isActive: true,
      isSystemAdmin: false,
      isEmailVerified: true,
      language: 'en',
      theme: 'system',
      autoCreated: true,
    });

    await this.repository.create(user);
    return user;
  }
}
