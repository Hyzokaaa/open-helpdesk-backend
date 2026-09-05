import { DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { User } from '../entities/user';
import { UserRepository } from '../repositories/user.repository';

interface ToggleActiveProps {
  targetUserId: string;
  isActive: boolean;
  requestingUserId: string;
}

export class ToggleUserActive {
  constructor(private readonly repository: UserRepository) {}

  async execute(props: ToggleActiveProps): Promise<User> {
    const user = await this.repository.findById(props.targetUserId);
    if (!user) throw new EntityNotFoundError('User not found');

    if (!props.isActive && user.isSystemAdmin) {
      const allUsers = await this.repository.findAll();
      const activeAdmins = allUsers.filter(u => u.isSystemAdmin && u.isActive && u.getId() !== props.targetUserId);
      if (activeAdmins.length === 0) {
        throw new DomainValidationError('Cannot deactivate the last system admin');
      }
    }

    user.isActive = props.isActive;
    await this.repository.update(user);
    return user;
  }
}
