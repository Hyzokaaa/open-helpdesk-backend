import { User } from '../../src/user/domain/entities/user';
import { UserRepository } from '../../src/user/domain/repositories/user.repository';

export class MockUserRepository implements UserRepository {
  private users: User[] = [];

  async create(user: User): Promise<void> {
    this.users.push(user);
  }

  async findById(id: string): Promise<User | null> {
    return this.users.find((u) => u.getId() === id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((u) => u.email === email) ?? null;
  }

  async findAll(): Promise<User[]> {
    return this.users;
  }

  async findByIds(ids: string[]): Promise<User[]> {
    return this.users.filter((u) => ids.includes(u.getId()));
  }

  async update(user: User): Promise<void> {
    const index = this.users.findIndex((u) => u.getId() === user.getId());
    if (index >= 0) this.users[index] = user;
  }

  seed(user: User): void {
    this.users.push(user);
  }
}
