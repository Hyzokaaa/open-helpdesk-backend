import { User } from '../entities/user';

export interface UserRepository {
  create(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAll(): Promise<User[]>;
  findByIds(ids: string[]): Promise<User[]>;
  update(user: User): Promise<void>;
}
