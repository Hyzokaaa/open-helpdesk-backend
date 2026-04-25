import { CreateUser } from '../../../../src/user/domain/services/user-create';
import { User } from '../../../../src/user/domain/entities/user';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';
import { FakePasswordHasher } from '../../../mocks/fake-password-hasher';
import { MockUserRepository } from '../../../mocks/mock-user.repository';
import { ConflictError } from '../../../../src/shared/domain/errors';

describe('CreateUser', () => {
  let service: CreateUser;
  let repository: MockUserRepository;

  beforeEach(() => {
    repository = new MockUserRepository();
    service = new CreateUser(new FakeIdGenerator(), repository, new FakePasswordHasher());
  });

  it('should create a user with hashed password', async () => {
    const user = await service.execute({
      email: 'test@example.com',
      password: 'secret123',
      firstName: 'John',
      lastName: 'Doe',
    });

    expect(user.email).toBe('test@example.com');
    expect(user.password).toBe('hashed:secret123');
    expect(user.firstName).toBe('John');
    expect(user.isActive).toBe(true);
    expect(user.isSystemAdmin).toBe(false);
  });

  it('should throw ConflictError when email already exists', async () => {
    repository.seed(
      new User({
        id: 'existing',
        email: 'test@example.com',
        password: 'hashed:x',
        firstName: 'Existing',
        lastName: 'User',
        isActive: true,
        isSystemAdmin: false,
        isEmailVerified: true,
        language: 'en',
        theme: 'system',
      }),
    );

    await expect(
      service.execute({
        email: 'test@example.com',
        password: 'pass',
        firstName: 'New',
        lastName: 'User',
      }),
    ).rejects.toThrow(ConflictError);
  });
});
