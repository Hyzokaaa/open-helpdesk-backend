import { AccessDeniedError } from '../../../shared/domain/errors';
import { IdGenerator } from '../../../shared/domain/id-generator';
import { PasswordHasher } from '../../../shared/domain/password-hasher';
import { User } from '../entities/user';
import { normalizeUserName } from '../user-name';
import { UserRepository } from '../repositories/user.repository';

interface AuthenticateOAuthProps {
  email: string;
  firstName: string;
  lastName: string;
  authProvider: string;
  /** Whether the provider itself vouches that the address belongs to the person signing in. */
  emailVerified: boolean;
}

export interface AuthenticateOAuthOptions {
  /**
   * Sign into an existing account even when the provider did not verify the email. Off by
   * default: an unverified profile email (any Microsoft account) is not proof of ownership, so
   * linking on it lets anyone take over the account registered with that address.
   */
  linkUnverifiedEmails?: boolean;
}

export class AuthenticateOAuth {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly options: AuthenticateOAuthOptions = {},
  ) {}

  async execute(props: AuthenticateOAuthProps): Promise<User> {
    const existing = await this.repository.findByEmail(props.email);

    if (existing) {
      if (!existing.isActive) {
        throw new Error('Account is deactivated');
      }
      if (!props.emailVerified && !this.options.linkUnverifiedEmails) {
        throw new AccessDeniedError(
          'This email is already registered. Sign in with your password instead.',
        );
      }
      if (props.emailVerified && !existing.isEmailVerified) {
        existing.isEmailVerified = true;
        await this.repository.update(existing);
      }
      return existing;
    }

    const randomPassword = Array.from({ length: 32 }, () =>
      Math.random().toString(36).charAt(2),
    ).join('');
    const hashedPassword = await this.passwordHasher.hash(randomPassword);

    const user = new User({
      id: this.idGenerator.create(),
      email: props.email,
      password: hashedPassword,
      firstName: normalizeUserName(props.firstName),
      lastName: normalizeUserName(props.lastName),
      isActive: true,
      isSystemAdmin: false,
      // Unverified addresses go through the usual email verification before the account is usable
      isEmailVerified: props.emailVerified,
      language: 'en',
      theme: 'system',
      autoCreated: false,
      authProvider: props.authProvider,
    });

    await this.repository.create(user);
    return user;
  }
}
