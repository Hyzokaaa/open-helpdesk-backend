import { Command } from '../../../shared/domain/command';
import { AccessDeniedError } from '../../../shared/domain/errors';
import { ToggleUserActive } from '../../domain/services/user-toggle-active';

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
  constructor(private readonly toggleActive: ToggleUserActive) {}

  async execute(props: Props): Promise<ToggleUserActiveResponse> {
    if (!props.requestingUserIsAdmin) {
      throw new AccessDeniedError('Only system admins can activate/deactivate users');
    }

    const user = await this.toggleActive.execute({
      targetUserId: props.targetUserId,
      isActive: props.isActive,
    });

    return { id: user.getId(), isActive: user.isActive };
  }
}
