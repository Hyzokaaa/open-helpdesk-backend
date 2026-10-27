import { AuthenticateOAuth } from '../../../../src/user/domain/services/user-authenticate-oauth';
import { User } from '../../../../src/user/domain/entities/user';
import { AccessDeniedError } from '../../../../src/shared/domain/errors';
import { MockUserRepository } from '../../../mocks/mock-user.repository';
import { FakePasswordHasher } from '../../../mocks/fake-password-hasher';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';

function victim() {
  return new User({
    id: 'victim', email: 'ceo@acme.com', password: 'hashed:secret', firstName: 'Ana', lastName: 'Ceo',
    isActive: true, isSystemAdmin: true, isEmailVerified: true, language: 'en', theme: 'system',
  });
}

describe('AuthenticateOAuth', () => {
  let users: MockUserRepository;
  const signIn = (email: string, emailVerified: boolean) =>
    new AuthenticateOAuth(new FakeIdGenerator(), users, new FakePasswordHasher())
      .execute({ email, firstName: 'Eve', lastName: 'X', authProvider: 'google', emailVerified });

  beforeEach(() => {
    users = new MockUserRepository();
    users.seed(victim());
  });

  it('does not sign someone into an existing account on an email the provider did not verify', async () => {
    await expect(signIn('ceo@acme.com', false)).rejects.toThrow(AccessDeniedError);
  });

  it('signs into the existing account when the provider verified the email', async () => {
    const user = await signIn('ceo@acme.com', true);
    expect(user.getId()).toBe('victim');
  });

  it('creates a new account unverified when the provider did not verify the email', async () => {
    const user = await signIn('new@acme.com', false);
    expect(user.isEmailVerified).toBe(false);
  });

  it('creates a new account verified when the provider verified the email', async () => {
    const user = await signIn('new@acme.com', true);
    expect(user.isEmailVerified).toBe(true);
  });

  describe('signup source', () => {
    const withSource = (email: string) =>
      new AuthenticateOAuth(new FakeIdGenerator(), users, new FakePasswordHasher())
        .execute({ email, firstName: 'Eve', lastName: 'X', authProvider: 'google', emailVerified: true, signupSource: { ref: 'Reddit' } });

    it('keeps it on the account this sign-in creates', async () => {
      expect((await withSource('new@acme.com')).signupSource?.channel).toBe('reddit');
    });

    it('never gives it to an existing account', async () => {
      expect((await withSource('ceo@acme.com')).signupSource).toBeNull();
    });
  });
});
