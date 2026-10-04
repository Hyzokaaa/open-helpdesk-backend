import { CreateUser } from '../../../../src/user/domain/services/user-create';
import { UpdateUserProfile } from '../../../../src/user/domain/services/user-update-profile';
import { AuthenticateOAuth } from '../../../../src/user/domain/services/user-authenticate-oauth';
import { User } from '../../../../src/user/domain/entities/user';
import { USER_NAME_MAX_LENGTH } from '../../../../src/user/domain/user-name';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';
import { FakePasswordHasher } from '../../../mocks/fake-password-hasher';
import { MockUserRepository } from '../../../mocks/mock-user.repository';

// Names are rendered by the client inside HTML (mentions, headers), so a tag in a name is a stored XSS.
const PAYLOAD = '<img src=x onerror=alert(1)>Eve';

describe('user name normalization', () => {
  let repository: MockUserRepository;

  beforeEach(() => {
    repository = new MockUserRepository();
  });

  describe('CreateUser (register, signup, portal, inbound email, import)', () => {
    it('stores names without tags, brackets or control characters', async () => {
      const service = new CreateUser(new FakeIdGenerator(), repository, new FakePasswordHasher());

      const user = await service.execute({
        email: 'eve@example.com',
        password: 'long-enough-password',
        firstName: PAYLOAD,
        lastName: `Smith${String.fromCodePoint(0x202e)} <b>`,
      });

      expect(user.firstName).toBe('Eve');
      expect(user.lastName).toBe('Smith');
      const stored = await repository.findById(user.getId());
      expect(stored!.firstName).not.toContain('<');
    });

    it('caps names at the maximum length', async () => {
      const service = new CreateUser(new FakeIdGenerator(), repository, new FakePasswordHasher());
      const user = await service.execute({
        email: 'eve@example.com',
        password: 'long-enough-password',
        firstName: 'a'.repeat(500),
        lastName: 'b',
      });
      expect(user.firstName).toHaveLength(USER_NAME_MAX_LENGTH);
    });
  });

  describe('UpdateUserProfile (PATCH users/me/name)', () => {
    it('stores names without tags', async () => {
      repository.seed(new User({
        id: 'user-1', email: 'eve@example.com', password: 'hashed:x', firstName: 'Eve', lastName: 'Smith',
        isActive: true, isSystemAdmin: false, isEmailVerified: true, language: 'en', theme: 'system',
      }));
      const service = new UpdateUserProfile(repository);

      const user = await service.execute({ userId: 'user-1', firstName: PAYLOAD, lastName: '<i>Lyn</i>' });

      expect(user.firstName).toBe('Eve');
      expect(user.lastName).toBe('Lyn');
    });

    it('leaves names untouched when they are not part of the update', async () => {
      repository.seed(new User({
        id: 'user-1', email: 'eve@example.com', password: 'hashed:x', firstName: 'Eve', lastName: 'Smith',
        isActive: true, isSystemAdmin: false, isEmailVerified: true, language: 'en', theme: 'system',
      }));
      const service = new UpdateUserProfile(repository);

      const user = await service.execute({ userId: 'user-1', language: 'es' });

      expect(user.firstName).toBe('Eve');
      expect(user.lastName).toBe('Smith');
    });
  });

  describe('AuthenticateOAuth (first sign-in through a provider)', () => {
    it('stores the provider-supplied names without tags', async () => {
      const service = new AuthenticateOAuth(new FakeIdGenerator(), repository, new FakePasswordHasher());

      const user = await service.execute({
        email: 'eve@example.com',
        firstName: PAYLOAD,
        lastName: 'Smith',
        authProvider: 'google',
        emailVerified: true,
      });

      expect(user.firstName).toBe('Eve');
      expect(user.lastName).toBe('Smith');
    });
  });
});
