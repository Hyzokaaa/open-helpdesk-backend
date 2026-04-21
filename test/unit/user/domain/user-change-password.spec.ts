import { ChangePassword } from '../../../../src/user/domain/services/user-change-password';
import { User } from '../../../../src/user/domain/entities/user';
import { FakePasswordHasher } from '../../../mocks/fake-password-hasher';
import { MockUserRepository } from '../../../mocks/mock-user.repository';
import { InvalidCredentialsError, EntityNotFoundError } from '../../../../src/shared/domain/errors';

describe('ChangePassword', () => {
  let service: ChangePassword;
  let repository: MockUserRepository;

  beforeEach(() => {
    repository = new MockUserRepository();
    service = new ChangePassword(repository, new FakePasswordHasher());

    repository.seed(
      new User({
        id: 'user-1',
        email: 'john@example.com',
        password: 'hashed:old-password',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        isSystemAdmin: false,
        language: 'en',
        theme: 'system',
      }),
    );
  });

  it('should change password when current password is correct', async () => {
    await service.execute({
      userId: 'user-1',
      currentPassword: 'old-password',
      newPassword: 'new-password',
    });

    const user = await repository.findById('user-1');
    expect(user!.password).toBe('hashed:new-password');
  });

  it('should throw InvalidCredentialsError when current password is wrong', async () => {
    await expect(
      service.execute({
        userId: 'user-1',
        currentPassword: 'wrong-password',
        newPassword: 'new-password',
      }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('should throw EntityNotFoundError when user does not exist', async () => {
    await expect(
      service.execute({
        userId: 'nonexistent',
        currentPassword: 'x',
        newPassword: 'y',
      }),
    ).rejects.toThrow(EntityNotFoundError);
  });
});
