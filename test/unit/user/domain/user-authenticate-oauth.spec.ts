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
  const signIn = (email: string, emailVerified: boolean, linkUnverifiedEmails?: boolean) =>
    new AuthenticateOAuth(new FakeIdGenerator(), users, new FakePasswordHasher(), { linkUnverifiedEmails })
      .execute({ email, firstName: 'Eve', lastName: 'X', authProvider: 'microsoft', emailVerified });

  beforeEach(() => {
    users = new MockUserRepository();
    users.seed(victim());
  });

  it('does not sign someone into an existing account on an email the provider did not verify', async () => {
    // A Microsoft account can carry any address as its profile email without owning it.
    await expect(signIn('ceo@acme.com', false)).rejects.toThrow(AccessDeniedError);
  });

  it('signs into the existing account when the provider verified the email', async () => {
    const user = await signIn('ceo@acme.com', true);
    expect(user.getId()).toBe('victim');
  });

  it('can be switched back to linking unverified emails, for installations that decide so', async () => {
    const user = await signIn('ceo@acme.com', false, true);
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
});
