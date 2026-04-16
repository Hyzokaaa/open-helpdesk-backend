import { UnauthorizedException } from '@nestjs/common';
import { PasswordHasher } from '../../../shared/infrastructure/password-hasher';
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
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await this.passwordHasher.compare(
      props.password,
      user.password,
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }
}
