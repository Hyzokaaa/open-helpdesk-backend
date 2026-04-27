import { Query } from '../../../shared/domain/query';
import { UserRepository } from '../../domain/repositories/user.repository';

export interface UserListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isSystemAdmin: boolean;
  isActive: boolean;
  planId?: string;
}

export class ListUsersQuery implements Query<void, UserListItem[]> {
  constructor(private readonly repository: UserRepository) {}

  async execute(): Promise<UserListItem[]> {
    const users = await this.repository.findAll();
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
