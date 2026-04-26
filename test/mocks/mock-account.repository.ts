import { Account } from '../../src/account/domain/entities/account';
import { AccountRepository } from '../../src/account/domain/repositories/account.repository';

export class MockAccountRepository implements AccountRepository {
  private accounts: Account[] = [];

  async create(account: Account): Promise<void> {
    this.accounts.push(account);
  }

  async findById(id: string): Promise<Account | null> {
    return this.accounts.find((a) => a.getId() === id) ?? null;
  }

  async findByOwnerId(ownerId: string): Promise<Account | null> {
    return this.accounts.find((a) => a.ownerId === ownerId) ?? null;
  }

  seed(account: Account): void {
    this.accounts.push(account);
  }
}
