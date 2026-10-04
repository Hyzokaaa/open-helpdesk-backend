import { EntityNotFoundError } from '../../../shared/domain/errors';
import { PasswordHasher } from '../../../shared/domain/password-hasher';
import { UserRepository } from '../repositories/user.repository';
import { ensurePasswordAcceptable } from '../password-policy';

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
    ensurePasswordAcceptable(props.newPassword);
    const user = await this.repository.findById(props.userId);
    if (!user) throw new EntityNotFoundError('User not found');

    user.password = await this.passwordHasher.hash(props.newPassword);
    // The reset link only reaches the account's inbox, so using it proves the address is theirs.
    user.isEmailVerified = true;
    await this.repository.update(user);
  }
}
