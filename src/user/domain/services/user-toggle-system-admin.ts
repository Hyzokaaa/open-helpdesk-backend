import { DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { User } from '../entities/user';
import { UserRepository } from '../repositories/user.repository';

interface ToggleSystemAdminProps {
  targetUserId: string;
  isSystemAdmin: boolean;
  requestingUserId: string;
}

export class ToggleSystemAdmin {
  constructor(private readonly repository: UserRepository) {}

  async execute(props: ToggleSystemAdminProps): Promise<User> {
    const user = await this.repository.findById(props.targetUserId);
    if (!user) throw new EntityNotFoundError('User not found');

    if (!props.isSystemAdmin) {
      const allUsers = await this.repository.findAll();
      const activeAdmins = allUsers.filter(u => u.isSystemAdmin && u.isActive && u.getId() !== props.targetUserId);
      if (activeAdmins.length === 0) {
        throw new DomainValidationError('Cannot remove the last system admin');
      }
    }

    user.isSystemAdmin = props.isSystemAdmin;
    await this.repository.update(user);
    return user;
  }
}
