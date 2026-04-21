import { EntityNotFoundError } from '../../../shared/domain/errors';
import { PasswordHasher } from '../../../shared/infrastructure/password-hasher';
import { UserRepository } from '../repositories/user.repository';

interface ResetPasswordProps {
  userId: string;
  newPassword: string;
}

export class ResetPassword {
  constructor(
    private readonly repository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(props: ResetPasswordProps): Promise<void> {
    const user = await this.repository.findById(props.userId);
    if (!user) throw new EntityNotFoundError('User not found');

    user.password = await this.passwordHasher.hash(props.newPassword);
    await this.repository.update(user);
  }
}
