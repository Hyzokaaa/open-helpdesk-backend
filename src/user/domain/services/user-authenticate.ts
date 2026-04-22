import { InvalidCredentialsError } from '../../../shared/domain/errors';
import { PasswordHasher } from '../../../shared/domain/password-hasher';
import { User } from '../entities/user';
import { UserRepository } from '../repositories/user.repository';

interface AuthenticateUserProps {
  email: string;
  password: string;
}

export class AuthenticateUser {
  constructor(
    private readonly repository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(props: AuthenticateUserProps): Promise<User> {
    const user = await this.repository.findByEmail(props.email);
    if (!user) {
      throw new InvalidCredentialsError('Invalid credentials');
    }

    const isValid = await this.passwordHasher.compare(
      props.password,
      user.password,
    );
    if (!isValid) {
      throw new InvalidCredentialsError('Invalid credentials');
    }

    return user;
  }
}
