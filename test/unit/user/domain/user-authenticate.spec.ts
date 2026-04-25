import { AuthenticateUser } from '../../../../src/user/domain/services/user-authenticate';
import { User } from '../../../../src/user/domain/entities/user';
import { FakePasswordHasher } from '../../../mocks/fake-password-hasher';
import { MockUserRepository } from '../../../mocks/mock-user.repository';
import { InvalidCredentialsError } from '../../../../src/shared/domain/errors';

describe('AuthenticateUser', () => {
  let service: AuthenticateUser;
  let repository: MockUserRepository;

  beforeEach(() => {
    repository = new MockUserRepository();
    service = new AuthenticateUser(repository, new FakePasswordHasher());

    repository.seed(
      new User({
        id: 'user-1',
        email: 'john@example.com',
        password: 'hashed:correct-password',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        isSystemAdmin: false,
        isEmailVerified: true,
        language: 'en',
        theme: 'system',
      }),
    );
  });

  it('should return the user when credentials are valid', async () => {
    const user = await service.execute({ email: 'john@example.com', password: 'correct-password' });

    expect(user.getId()).toBe('user-1');
    expect(user.email).toBe('john@example.com');
  });

  it('should throw InvalidCredentialsError when email does not exist', async () => {
    await expect(
      service.execute({ email: 'nobody@example.com', password: 'x' }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('should throw InvalidCredentialsError when password is wrong', async () => {
    await expect(
      service.execute({ email: 'john@example.com', password: 'wrong-password' }),
    ).rejects.toThrow(InvalidCredentialsError);
  });
});
