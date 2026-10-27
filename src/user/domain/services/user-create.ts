import { ConflictError } from '../../../shared/domain/errors';
import { IdGenerator } from '../../../shared/domain/id-generator';
import { PasswordHasher } from '../../../shared/domain/password-hasher';
import { User } from '../entities/user';
import { normalizeUserName } from '../user-name';
import { ensurePasswordAcceptable } from '../password-policy';
import { UserRepository } from '../repositories/user.repository';
import { UserSignupMethod } from '../enums/user-signup-method.enum';
import { normalizeSignupSource, RawSignupSource } from '../user-signup-source';

interface CreateUserProps {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  isSystemAdmin?: boolean;
  isEmailVerified?: boolean;
  autoCreated?: boolean;
  /** How the account came to exist; an auto-created account is a ticket's reporter unless told otherwise */
  signupMethod?: UserSignupMethod;
  /** Where the person came from, as their browser sent it with the signup */
  signupSource?: RawSignupSource | null;
}

export class CreateUser {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(props: CreateUserProps): Promise<User> {
    const existing = await this.repository.findByEmail(props.email);
    if (existing) {
      throw new ConflictError('Email already registered');
    }

    ensurePasswordAcceptable(props.password);
    const hashedPassword = await this.passwordHasher.hash(props.password);

    const user = new User({
      id: this.idGenerator.create(),
      email: props.email,
      password: hashedPassword,
      firstName: normalizeUserName(props.firstName),
      lastName: normalizeUserName(props.lastName),
      isActive: true,
      isSystemAdmin: props.isSystemAdmin ?? false,
      isEmailVerified: props.isEmailVerified ?? true,
      language: 'en',
      theme: 'system',
      autoCreated: props.autoCreated ?? false,
      signupMethod: props.signupMethod ?? (props.autoCreated ? UserSignupMethod.REPORTER : null),
      signupSource: normalizeSignupSource(props.signupSource),
    });

    await this.repository.create(user);
    return user;
  }
}
