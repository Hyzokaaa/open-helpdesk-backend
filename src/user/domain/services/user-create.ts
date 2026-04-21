import { ConflictError } from '../../../shared/domain/errors';
import { IdGenerator } from '../../../shared/domain/id-generator';
import { PasswordHasher } from '../../../shared/infrastructure/password-hasher';
import { User } from '../entities/user';
import { UserRepository } from '../repositories/user.repository';

interface CreateUserProps {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  isSystemAdmin?: boolean;
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

    const hashedPassword = await this.passwordHasher.hash(props.password);

    const user = new User({
      id: this.idGenerator.create(),
      email: props.email,
      password: hashedPassword,
      firstName: props.firstName,
      lastName: props.lastName,
      isActive: true,
      isSystemAdmin: props.isSystemAdmin ?? false,
      language: 'en',
      theme: 'system',
    });

    await this.repository.create(user);
    return user;
  }
}
