import { IdGenerator } from '../../../shared/domain/id-generator';
import { AccountRepository } from '../repositories/account.repository';
import { Account } from '../entities/account';

interface CreateAccountForUserProps {
  userId: string;
  firstName: string;
}

export class CreateAccountForUser {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(props: CreateAccountForUserProps): Promise<Account> {
    const account = new Account({
      id: this.idGenerator.create(),
      ownerId: props.userId,
      name: `${props.firstName}'s Account`,
    });
    await this.accountRepository.create(account);
    return account;
  }
}
