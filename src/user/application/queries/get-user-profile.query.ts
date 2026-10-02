import { EntityNotFoundError } from '../../../shared/domain/errors';
import { Query } from '../../../shared/domain/query';
import { StorageService } from '../../../shared/domain/storage-service';
import { UserRepository } from '../../domain/repositories/user.repository';
import { ResolveWorkspaceCreationPolicy } from '../../../workspace/domain/services/workspace-creation-policy-resolve';

interface Props {
  userId: string;
}

export interface UserProfileResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isSystemAdmin: boolean;
  isEmailVerified: boolean;
  language: string;
  theme: string;
  dateFormat: string;
  timezone: string;
  avatarUrl: string | null;
  /** What this user may do across the installation, decided here so the client never re-derives it. */
  capabilities: {
    createWorkspace: boolean;
  };
}

export class GetUserProfileQuery implements Query<Props, UserProfileResponse> {
  constructor(
    private readonly repository: UserRepository,
    private readonly storage?: StorageService,
    private readonly resolveCreationPolicy?: ResolveWorkspaceCreationPolicy,
  ) {}

  async execute(props: Props): Promise<UserProfileResponse> {
    const user = await this.repository.findById(props.userId);
    if (!user) {
      throw new EntityNotFoundError('User not found');
    }

    let avatarUrl: string | null = null;
    if (user.avatarKey && this.storage) {
      avatarUrl = await this.storage.getPresignedUrl(user.avatarKey);
    }

    // Same rule as creating one: system admins always, others only with self-service on
    const createWorkspace = user.isSystemAdmin
      || (this.resolveCreationPolicy ? (await this.resolveCreationPolicy.execute()).selfService : false);

    return {
      id: user.getId(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      isSystemAdmin: user.isSystemAdmin,
      isEmailVerified: user.isEmailVerified,
      language: user.language,
      theme: user.theme,
      dateFormat: user.dateFormat,
      timezone: user.timezone,
      avatarUrl,
      capabilities: { createWorkspace },
    };
  }
}
