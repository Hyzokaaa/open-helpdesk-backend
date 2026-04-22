import { EntityNotFoundError } from '../../../shared/domain/errors';
import { User } from '../entities/user';
import { UserRepository } from '../repositories/user.repository';

interface ToggleSystemAdminProps {
  targetUserId: string;
  isSystemAdmin: boolean;
}

export class ToggleSystemAdmin {
  constructor(private readonly repository: UserRepository) {}

  async execute(props: ToggleSystemAdminProps): Promise<User> {
    const user = await this.repository.findById(props.targetUserId);
    if (!user) throw new EntityNotFoundError('User not found');

    user.isSystemAdmin = props.isSystemAdmin;
    await this.repository.update(user);
    return user;
  }
}
