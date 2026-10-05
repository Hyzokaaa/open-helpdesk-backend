import { AccessDeniedError } from '../../../../src/shared/domain/errors';
import { ListUsersQuery } from '../../../../src/user/application/queries/list-users.query';
import { User } from '../../../../src/user/domain/entities/user';
import { MockUserRepository } from '../../../mocks/mock-user.repository';

describe('GET /users (ListUsersQuery)', () => {
  let users: MockUserRepository;

  beforeEach(() => {
    users = new MockUserRepository();
    for (const id of ['alice', 'bob', 'carol']) {
      users.seed(new User({
        id, email: `${id}@other-company.test`, password: 'x', firstName: id, lastName: 'X',
        isActive: true, isSystemAdmin: false, isEmailVerified: true, language: 'en', theme: 'system',
      }));
    }
  });

  it('does not expose every user of the instance to an ordinary authenticated user', async () => {
    await expect(
      new ListUsersQuery(users).execute({ requestingUserIsAdmin: false }),
    ).rejects.toThrow(AccessDeniedError);
  });

  it('lists every user for a system admin', async () => {
    const result = await new ListUsersQuery(users).execute({ requestingUserIsAdmin: true });
    expect(result.map((u) => u.email)).toEqual([
      'alice@other-company.test', 'bob@other-company.test', 'carol@other-company.test',
    ]);
    expect(result[0]).not.toHaveProperty('password');
  });
});
