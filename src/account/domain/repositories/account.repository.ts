import { Account } from '../entities/account';

export interface AccountRepository {
  create(account: Account): Promise<void>;
  findById(id: string): Promise<Account | null>;
  findByOwnerId(ownerId: string): Promise<Account | null>;
}
