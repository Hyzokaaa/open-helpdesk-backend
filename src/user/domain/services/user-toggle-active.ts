import { EntityNotFoundError } from '../../../shared/domain/errors';
import { User } from '../entities/user';
import { UserRepository } from '../repositories/user.repository';

interface ToggleActiveProps {
  targetUserId: string;
  isActive: boolean;
}

export class ToggleUserActive {
  constructor(private readonly repository: UserRepository) {}

  async execute(props: ToggleActiveProps): Promise<User> {
    const user = await this.repository.findById(props.targetUserId);
    if (!user) throw new EntityNotFoundError('User not found');

    user.isActive = props.isActive;
    await this.repository.update(user);
    return user;
  }
}
