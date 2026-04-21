import { Command } from '../../../shared/domain/command';
import { AccessDeniedError, EntityNotFoundError } from '../../../shared/domain/errors';
import { UserRepository } from '../../domain/repositories/user.repository';

interface Props {
  targetUserId: string;
  isSystemAdmin: boolean;
  requestingUserIsAdmin: boolean;
}

export interface ToggleSystemAdminResponse {
  id: string;
  isSystemAdmin: boolean;
}

export class ToggleSystemAdminCommand implements Command<Props, ToggleSystemAdminResponse> {
  constructor(private readonly repository: UserRepository) {}

  async execute(props: Props): Promise<ToggleSystemAdminResponse> {
    if (!props.requestingUserIsAdmin) {
      throw new AccessDeniedError('Only system admins can manage system admin roles');
    }

    const target = await this.repository.findById(props.targetUserId);
    if (!target) throw new EntityNotFoundError('User not found');

    target.isSystemAdmin = props.isSystemAdmin;
    await this.repository.update(target);

    return { id: target.getId(), isSystemAdmin: target.isSystemAdmin };
  }
}
