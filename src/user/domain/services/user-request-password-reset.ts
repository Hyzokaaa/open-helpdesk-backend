import { EntityNotFoundError } from '../../../shared/domain/errors';
import { UserRepository } from '../repositories/user.repository';

interface RequestPasswordResetProps {
  email: string;
}

export interface PasswordResetResult {
  userId: string;
  email: string;
  firstName: string;
  language: string;
}

export class RequestPasswordReset {
  constructor(private readonly repository: UserRepository) {}

  async execute(props: RequestPasswordResetProps): Promise<PasswordResetResult | null> {
    const user = await this.repository.findByEmail(props.email);
    if (!user) return null;

    return {
      userId: user.getId(),
      email: user.email,
      firstName: user.firstName,
      language: user.language,
    };
  }
}
