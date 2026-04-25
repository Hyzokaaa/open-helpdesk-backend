import { EntityNotFoundError } from '../../../shared/domain/errors';
import { UserRepository } from '../repositories/user.repository';

export class VerifyEmail {
  constructor(private readonly repository: UserRepository) {}

  async execute(props: { userId: string }): Promise<void> {
    const user = await this.repository.findById(props.userId);
    if (!user) {
      throw new EntityNotFoundError('User not found');
    }

    user.isEmailVerified = true;
    await this.repository.update(user);
  }
}
