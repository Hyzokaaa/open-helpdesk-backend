import { IdGenerator } from '../../../shared/domain/id-generator';
import { PasswordHasher } from '../../../shared/domain/password-hasher';
import { User } from '../entities/user';
import { UserRepository } from '../repositories/user.repository';

interface AuthenticateOAuthProps {
  email: string;
  firstName: string;
  lastName: string;
  authProvider: string;
  /** Whether the provider itself vouches that the address belongs to the person signing in. */
  emailVerified: boolean;
}

export class AuthenticateOAuth {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(props: AuthenticateOAuthProps): Promise<User> {
    const existing = await this.repository.findByEmail(props.email);

    if (existing) {
      if (!existing.isActive) {
        throw new Error('Account is deactivated');
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
      firstName: props.firstName,
      lastName: props.lastName,
      isActive: true,
      isSystemAdmin: false,
      isEmailVerified: true,
      language: 'en',
      theme: 'system',
      autoCreated: false,
      authProvider: props.authProvider,
    });

    await this.repository.create(user);
    return user;
  }
}
