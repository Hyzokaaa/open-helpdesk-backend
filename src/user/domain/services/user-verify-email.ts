import { EntityNotFoundError } from '../../../shared/domain/errors';
import { UserRepository } from '../repositories/user.repository';

export interface VerifyEmailResult {
  /** False when the email was already verified: opening the link again changes nothing. */
  newlyVerified: boolean;
}

export class VerifyEmail {
  constructor(private readonly repository: UserRepository) {}

  async execute(props: { userId: string }): Promise<VerifyEmailResult> {
    const user = await this.repository.findById(props.userId);
    if (!user) {
      throw new EntityNotFoundError('User not found');
    }
    if (user.isEmailVerified) return { newlyVerified: false };

    user.isEmailVerified = true;
    await this.repository.update(user);
    return { newlyVerified: true };
  }
}
