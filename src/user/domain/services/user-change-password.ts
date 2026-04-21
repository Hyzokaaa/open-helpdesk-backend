import { InvalidCredentialsError } from '../../../shared/domain/errors';
import { PasswordHasher } from '../../../shared/infrastructure/password-hasher';
import { UserRepository } from '../repositories/user.repository';
import { EntityNotFoundError } from '../../../shared/domain/errors';

interface ChangePasswordProps {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export class ChangePassword {
  constructor(
    private readonly repository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(props: ChangePasswordProps): Promise<void> {
    const user = await this.repository.findById(props.userId);
    if (!user) throw new EntityNotFoundError('User not found');

    const isValid = await this.passwordHasher.compare(props.currentPassword, user.password);
    if (!isValid) {
      throw new InvalidCredentialsError('Current password is incorrect');
    }

    user.password = await this.passwordHasher.hash(props.newPassword);
    await this.repository.update(user);
  }
}
