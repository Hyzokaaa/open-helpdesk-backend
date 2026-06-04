import { CreateAccountForUser } from '../../../../src/account/domain/services/account-create-for-user';
import { MockAccountRepository } from '../../../mocks/mock-account.repository';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';

describe('CreateAccountForUser', () => {
  let service: CreateAccountForUser;
  let repository: MockAccountRepository;
  let idGenerator: FakeIdGenerator;

  beforeEach(() => {
    repository = new MockAccountRepository();
    idGenerator = new FakeIdGenerator();
    service = new CreateAccountForUser(idGenerator, repository);
  });

  it('should create account with correct owner and name', async () => {
    const account = await service.execute({ userId: 'u-1', firstName: 'John' });

    expect(account.ownerId).toBe('u-1');
    expect(account.name).toBe("John's Account");
  });

  it('should persist the account in the repository', async () => {
    const account = await service.execute({ userId: 'u-1', firstName: 'Jane' });

    const found = await repository.findById(account.getId());
    expect(found).not.toBeNull();
    expect(found!.ownerId).toBe('u-1');
    expect(found!.name).toBe("Jane's Account");
  });

  it('should return the created account with a generated id', async () => {
    const account = await service.execute({ userId: 'u-2', firstName: 'Alice' });

    expect(account.getId()).toBe('test-id-1');
    expect(account.ownerId).toBe('u-2');
  });
});
