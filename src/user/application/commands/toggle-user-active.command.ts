import { Command } from '../../../shared/domain/command';
import { AccessDeniedError, EntityNotFoundError } from '../../../shared/domain/errors';
import { UserRepository } from '../../domain/repositories/user.repository';

interface Props {
  targetUserId: string;
  isActive: boolean;
  requestingUserIsAdmin: boolean;
}

export interface ToggleUserActiveResponse {
  id: string;
  isActive: boolean;
}

export class ToggleUserActiveCommand implements Command<Props, ToggleUserActiveResponse> {
  constructor(private readonly repository: UserRepository) {}

  async execute(props: Props): Promise<ToggleUserActiveResponse> {
    if (!props.requestingUserIsAdmin) {
      throw new AccessDeniedError('Only system admins can activate/deactivate users');
    }

    const target = await this.repository.findById(props.targetUserId);
    if (!target) throw new EntityNotFoundError('User not found');

    target.isActive = props.isActive;
    await this.repository.update(target);

    return { id: target.getId(), isActive: target.isActive };
  }
}
