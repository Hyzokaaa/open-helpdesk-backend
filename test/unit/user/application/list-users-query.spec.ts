import { AccessDeniedError } from '../../../../src/shared/domain/errors';
import { ListUsersQuery } from '../../../../src/user/application/queries/list-users.query';
import { User } from '../../../../src/user/domain/entities/user';
import { MockUserRepository } from '../../../mocks/mock-user.repository';
import { FakeS3Storage } from '../../../mocks/fake-s3-storage';

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

  it('signs the photo of users who have one and leaves the rest null', async () => {
    const alice = await users.findById('alice');
    alice!.avatarKey = 'users/alice/avatar.png';
    const result = await new ListUsersQuery(users, new FakeS3Storage()).execute({ requestingUserIsAdmin: true });
    expect(result.map((u) => u.avatarUrl)).toEqual(['https://fake-s3.com/users/alice/avatar.png', null, null]);
  });
});
