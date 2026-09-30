import { EntityNotFoundError } from '../../../shared/domain/errors';
import { Query } from '../../../shared/domain/query';
import { StorageService } from '../../../shared/domain/storage-service';
import { UserRepository } from '../../domain/repositories/user.repository';

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
}

export class GetUserProfileQuery implements Query<Props, UserProfileResponse> {
  constructor(
    private readonly repository: UserRepository,
    private readonly storage?: StorageService,
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
    };
  }
}
