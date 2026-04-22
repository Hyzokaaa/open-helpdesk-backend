import { Command } from '../../../shared/domain/command';
import { AccessDeniedError } from '../../../shared/domain/errors';
import { ToggleSystemAdmin } from '../../domain/services/user-toggle-system-admin';

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
  constructor(private readonly toggleSystemAdmin: ToggleSystemAdmin) {}

  async execute(props: Props): Promise<ToggleSystemAdminResponse> {
    if (!props.requestingUserIsAdmin) {
      throw new AccessDeniedError('Only system admins can manage system admin roles');
    }

    const user = await this.toggleSystemAdmin.execute({
      targetUserId: props.targetUserId,
      isSystemAdmin: props.isSystemAdmin,
    });

    return { id: user.getId(), isSystemAdmin: user.isSystemAdmin };
  }
}
