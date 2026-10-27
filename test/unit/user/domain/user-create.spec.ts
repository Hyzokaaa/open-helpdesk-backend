import { CreateUser } from '../../../../src/user/domain/services/user-create';
import { User } from '../../../../src/user/domain/entities/user';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';
import { FakePasswordHasher } from '../../../mocks/fake-password-hasher';
import { MockUserRepository } from '../../../mocks/mock-user.repository';
import { ConflictError } from '../../../../src/shared/domain/errors';
import { UserSignupMethod } from '../../../../src/user/domain/enums/user-signup-method.enum';

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

  it('should default isEmailVerified to true', async () => {
    const user = await service.execute({
      email: 'admin@example.com',
      password: 'password1',
      firstName: 'Admin',
      lastName: 'User',
    });

    expect(user.isEmailVerified).toBe(true);
  });

  it('should respect isEmailVerified when set to false', async () => {
    const user = await service.execute({
      email: 'signup@example.com',
      password: 'password1',
      firstName: 'Signup',
      lastName: 'User',
      isEmailVerified: false,
    });

    expect(user.isEmailVerified).toBe(false);
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
        password: 'password1',
        firstName: 'New',
        lastName: 'User',
      }),
    ).rejects.toThrow(ConflictError);
  });

  describe('signup method', () => {
    const base = { email: 'm@example.com', password: 'secret123', firstName: 'M', lastName: 'N' };

    it('keeps the method it is told', async () => {
      const user = await service.execute({ ...base, signupMethod: UserSignupMethod.INVITATION });
      expect(user.signupMethod).toBe(UserSignupMethod.INVITATION);
    });

    it('makes an auto-created account a reporter unless told otherwise', async () => {
      expect((await service.execute({ ...base, autoCreated: true })).signupMethod).toBe(UserSignupMethod.REPORTER);
      const imported = await service.execute({ ...base, email: 'i@example.com', autoCreated: true, signupMethod: UserSignupMethod.IMPORT });
      expect(imported.signupMethod).toBe(UserSignupMethod.IMPORT);
    });

    it('leaves it empty when nobody says how', async () => {
      expect((await service.execute(base)).signupMethod).toBeNull();
    });
  });

  describe('signup source', () => {
    const base = { email: 's@example.com', password: 'secret123', firstName: 'S', lastName: 'T' };

    it('keeps the cleaned source sent with the signup', async () => {
      const user = await service.execute({ ...base, signupSource: { utmSource: 'Google', landingPath: '/?q=1' } });
      expect(user.signupSource).toMatchObject({ channel: 'google', utmSource: 'google', landingPath: '/' });
    });

    it('leaves it empty when the browser sent none', async () => {
      expect((await service.execute(base)).signupSource).toBeNull();
    });
  });
});
