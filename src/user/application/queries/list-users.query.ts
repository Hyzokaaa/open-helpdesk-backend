import { Query } from '../../../shared/domain/query';
import { AccessDeniedError } from '../../../shared/domain/errors';
import { SortOptions } from '../../../shared/domain/sort-options';
import { UserRepository } from '../../domain/repositories/user.repository';

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
  planId?: string;
}

export class ListUsersQuery implements Query<Props, UserListItem[]> {
  constructor(private readonly repository: UserRepository) {}

  async execute(props: Props): Promise<UserListItem[]> {
    if (!props.requestingUserIsAdmin) {
      throw new AccessDeniedError('Only system admins can list all users');
    }

    const users = await this.repository.findAll(props.sort);
    return users.map((u) => ({
      id: u.getId(),
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      isSystemAdmin: u.isSystemAdmin,
      isActive: u.isActive,
    }));
  }
}
