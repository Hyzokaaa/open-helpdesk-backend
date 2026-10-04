import { ResetPassword } from '../../../../src/user/domain/services/user-reset-password';
import { AuthenticateOAuth } from '../../../../src/user/domain/services/user-authenticate-oauth';
import { User } from '../../../../src/user/domain/entities/user';
import { MockUserRepository } from '../../../mocks/mock-user.repository';
import { FakePasswordHasher } from '../../../mocks/fake-password-hasher';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';

// Accounts created by an import start unverified and without a usable password.
function importedUser() {
  return new User({
    id: 'user-1', email: 'ana@example.com', password: 'hashed:unknown', firstName: 'Ana', lastName: '',
    isActive: true, isSystemAdmin: false, isEmailVerified: false, language: 'en', theme: 'system',
  });
}

describe('Email verification by proof of the address', () => {
  let users: MockUserRepository;

  beforeEach(() => {
    users = new MockUserRepository();
    users.seed(importedUser());
  });

  it('verifies the email when the password is set from the emailed link', async () => {
    await new ResetPassword(users, new FakePasswordHasher()).execute({ userId: 'user-1', newPassword: 'chosen-by-ana' });

    expect((await users.findById('user-1'))!.isEmailVerified).toBe(true);
  });

  describe('signing in with a provider', () => {
    const signIn = (emailVerified: boolean) =>
      new AuthenticateOAuth(new FakeIdGenerator(), users, new FakePasswordHasher()).execute({
        email: 'ana@example.com', firstName: 'Ana', lastName: '', authProvider: 'google', emailVerified,
      });

    it('verifies the email when the provider vouches for the address', async () => {
      await signIn(true);
      expect((await users.findById('user-1'))!.isEmailVerified).toBe(true);
    });

    it('leaves it unverified when the provider does not', async () => {
      await signIn(false);
      expect((await users.findById('user-1'))!.isEmailVerified).toBe(false);
    });
  });
});
