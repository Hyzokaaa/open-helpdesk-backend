import { IdGenerator } from '../../../shared/domain/id-generator';
import { PasswordHasher } from '../../../shared/domain/password-hasher';
import { User } from '../entities/user';
import { UserRepository } from '../repositories/user.repository';

interface ExchangeTokenProps {
  email: string;
  firstName: string;
  lastName: string;
}

export class ExchangeToken {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(props: ExchangeTokenProps): Promise<User> {
    const existing = await this.repository.findByEmail(props.email);
    if (existing) {
      if (existing.firstName !== props.firstName || existing.lastName !== props.lastName) {
        existing.firstName = props.firstName;
        existing.lastName = props.lastName;
        await this.repository.update(existing);
      }
      return existing;
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
