import { Query } from '../../../shared/domain/query';
import { StorageService } from '../../../shared/domain/storage-service';
import { AccessDeniedError } from '../../../shared/domain/errors';
import { SortOptions } from '../../../shared/domain/sort-options';
import { UserRepository } from '../../domain/repositories/user.repository';
import { UserSignupMethod } from '../../domain/enums/user-signup-method.enum';
import { UserSignupSource } from '../../domain/user-signup-source';

interface Props {
  sort?: SortOptions;
  /** The instance-wide user directory is for system admins only; workspace pickers use the members endpoint. */
  requestingUserIsAdmin: boolean;
}

export interface UserListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isSystemAdmin: boolean;
  isActive: boolean;
  /** Signed link to the profile photo; null when the user has none. */
  avatarUrl: string | null;
  createdAt: string | null;
  signupMethod: UserSignupMethod | null;
  signupSource: UserSignupSource | null;
  planId?: string;
}

export class ListUsersQuery implements Query<Props, UserListItem[]> {
  constructor(
    private readonly repository: UserRepository,
    private readonly storage?: StorageService,
  ) {}

  async execute(props: Props): Promise<UserListItem[]> {
    if (!props.requestingUserIsAdmin) {
      throw new AccessDeniedError('Only system admins can list all users');
    }

    const users = await this.repository.findAll(props.sort);
    return Promise.all(users.map(async (u) => ({
      id: u.getId(),
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      isSystemAdmin: u.isSystemAdmin,
      isActive: u.isActive,
      avatarUrl: u.avatarKey && this.storage ? await this.storage.getPresignedUrl(u.avatarKey) : null,
      createdAt: u.createdAt?.toISOString() ?? null,
      signupMethod: u.signupMethod,
      signupSource: u.signupSource,
    })));
  }
}
