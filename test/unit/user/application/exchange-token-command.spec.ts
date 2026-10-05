import { ExchangeTokenCommand } from '../../../../src/user/application/commands/exchange-token.command';
import { ExchangeToken } from '../../../../src/user/domain/services/user-exchange-token';
import { AddWorkspaceMember } from '../../../../src/workspace/domain/services/workspace-add-member';
import { User } from '../../../../src/user/domain/entities/user';
import { WorkspaceMember } from '../../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { TokenService } from '../../../../src/shared/domain/token-service';
import { MockUserRepository } from '../../../mocks/mock-user.repository';
import { MockWorkspaceMemberRepository } from '../../../mocks/mock-workspace-member.repository';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';
import { FakePasswordHasher } from '../../../mocks/fake-password-hasher';

// Encodes the claims so a test can read what the issued token would grant
class FakeTokenService implements TokenService {
  sign(payload: Record<string, unknown>): string {
    return JSON.stringify(payload);
  }

  verify<T>(token: string): T {
    return JSON.parse(token) as T;
  }
}

describe('ExchangeTokenCommand', () => {
  let users: MockUserRepository;
  let members: MockWorkspaceMemberRepository;
  let command: ExchangeTokenCommand;

  const seedUser = (id: string, email: string, extra: Partial<{ isSystemAdmin: boolean; isActive: boolean }> = {}) => {
    const user = new User({
      id, email, password: 'hashed:x', firstName: 'Real', lastName: 'Name',
      isActive: extra.isActive ?? true, isSystemAdmin: extra.isSystemAdmin ?? false,
      isEmailVerified: true, language: 'en', theme: 'system',
    });
    users.seed(user);
    return user;
  };

  // The API key belongs to workspace "ws-integration"
  const exchange = (email: string, role = WorkspaceRole.USER, allowElevatedRoles = false) =>
    command.execute({ email, firstName: 'Given', lastName: 'Name', role, workspaceId: 'ws-integration', allowElevatedRoles });

  const seedMember = (userId: string, role: WorkspaceRole) =>
    members.seed(new WorkspaceMember({ id: `m-${userId}`, workspaceId: 'ws-integration', userId, role }));

  beforeEach(() => {
    users = new MockUserRepository();
    members = new MockWorkspaceMemberRepository();
    const ids = new FakeIdGenerator();
    command = new ExchangeTokenCommand(
      new ExchangeToken(ids, users, new FakePasswordHasher(), members),
      new AddWorkspaceMember(ids, members),
      new FakeTokenService(),
      '1d',
    );
  });

  describe('attacks', () => {
    it('does not issue a token for the system admin of the installation', async () => {
      seedUser('root', 'root@helpdesk.test', { isSystemAdmin: true });

      await expect(exchange('root@helpdesk.test')).rejects.toThrow();
    });

    it('does not issue a token for a user who belongs to another workspace only', async () => {
      seedUser('victim', 'victim@other.test');
      members.seed(new WorkspaceMember({ id: 'm-v', workspaceId: 'ws-other', userId: 'victim', role: WorkspaceRole.ADMIN }));

      await expect(exchange('victim@other.test')).rejects.toThrow();
    });

    it('does not pull an outside user into the workspace or rename them', async () => {
      seedUser('victim', 'victim@other.test');

      await exchange('victim@other.test').catch(() => {});

      expect(await members.findByWorkspaceAndUser('ws-integration', 'victim')).toBeNull();
      expect((await users.findById('victim'))!.firstName).toBe('Real');
    });

    it('does not issue a token for a deactivated user', async () => {
      seedUser('gone', 'gone@helpdesk.test', { isActive: false });
      members.seed(new WorkspaceMember({ id: 'm-g', workspaceId: 'ws-integration', userId: 'gone', role: WorkspaceRole.USER }));

      await expect(exchange('gone@helpdesk.test')).rejects.toThrow();
    });
  });

  describe('supervisors and admins of the workspace', () => {
    it('are out of reach of a key without the admin scope', async () => {
      seedUser('boss', 'boss@customer.test');
      seedMember('boss', WorkspaceRole.ADMIN);

      await expect(exchange('boss@customer.test')).rejects.toThrow();
      await expect(exchange('new-admin@customer.test', WorkspaceRole.ADMIN)).rejects.toThrow();
      expect(await users.findByEmail('new-admin@customer.test')).toBeNull();
    });

    it('can be signed in and created by a key with the admin scope', async () => {
      seedUser('boss', 'boss@customer.test');
      seedMember('boss', WorkspaceRole.SUPERVISOR);

      await expect(exchange('boss@customer.test', WorkspaceRole.USER, true)).resolves.toBeDefined();
      const created = await exchange('new-admin@customer.test', WorkspaceRole.ADMIN, true);
      expect((await members.findByWorkspaceAndUser('ws-integration', created.user.id))!.role).toBe(WorkspaceRole.ADMIN);
    });

    it('never reaches the system admin or other workspaces, even with the admin scope', async () => {
      seedUser('root', 'root@helpdesk.test', { isSystemAdmin: true });
      seedMember('root', WorkspaceRole.ADMIN);
      seedUser('victim', 'victim@other.test');

      await expect(exchange('root@helpdesk.test', WorkspaceRole.USER, true)).rejects.toThrow();
      await expect(exchange('victim@other.test', WorkspaceRole.USER, true)).rejects.toThrow();
    });
  });

  describe('legitimate use', () => {
    it('creates a new user, adds them to the workspace and signs them in', async () => {
      const result = await exchange('new@customer.test');

      const claims = JSON.parse(result.accessToken);
      expect(claims.isSystemAdmin).toBe(false);
      expect(await members.findByWorkspaceAndUser('ws-integration', result.user.id)).not.toBeNull();
    });

    it('signs in a user the integration already created in its workspace', async () => {
      seedUser('known', 'known@customer.test');
      members.seed(new WorkspaceMember({ id: 'm-k', workspaceId: 'ws-integration', userId: 'known', role: WorkspaceRole.USER }));

      const result = await exchange('known@customer.test');

      expect(result.user.id).toBe('known');
    });
  });
});
