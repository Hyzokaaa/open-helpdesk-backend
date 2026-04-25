import { VerifyEmail } from '../../../../src/user/domain/services/user-verify-email';
import { User } from '../../../../src/user/domain/entities/user';
import { MockUserRepository } from '../../../mocks/mock-user.repository';
import { EntityNotFoundError } from '../../../../src/shared/domain/errors';

describe('VerifyEmail', () => {
  let service: VerifyEmail;
  let repository: MockUserRepository;

  beforeEach(() => {
    repository = new MockUserRepository();
    service = new VerifyEmail(repository);
  });

  it('should set isEmailVerified to true', async () => {
    repository.seed(
      new User({
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed:pass',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        isSystemAdmin: false,
        isEmailVerified: false,
        language: 'en',
        theme: 'system',
      }),
    );

    await service.execute({ userId: 'user-1' });

    const user = await repository.findById('user-1');
    expect(user!.isEmailVerified).toBe(true);
  });

  it('should throw EntityNotFoundError if user does not exist', async () => {
    await expect(service.execute({ userId: 'non-existent' })).rejects.toThrow(
      EntityNotFoundError,
    );
  });
});
