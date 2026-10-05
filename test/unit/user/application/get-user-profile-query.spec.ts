import { GetUserProfileQuery } from '../../../../src/user/application/queries/get-user-profile.query';
import { User } from '../../../../src/user/domain/entities/user';
import { ResolveWorkspaceCreationPolicy } from '../../../../src/workspace/domain/services/workspace-creation-policy-resolve';
import { WorkspaceCreationSettings } from '../../../../src/workspace/domain/entities/workspace-creation-settings';
import { MockUserRepository } from '../../../mocks/mock-user.repository';

describe('GetUserProfileQuery capabilities', () => {
  let users: MockUserRepository;

  const seedUser = (id: string, isSystemAdmin: boolean) =>
    users.seed(new User({
      id, email: `${id}@test.local`, password: 'x', firstName: 'A', lastName: 'B',
      isActive: true, isSystemAdmin, isEmailVerified: true, language: 'en', theme: 'system',
    }));

  // Settings saved in the admin panel, and the environment override (null leaves it to the panel)
  const profile = (userId: string, panelSelfService: boolean | null, environmentSelfService: boolean | null = null) => {
    const settings = {
      find: async () => (panelSelfService === null ? null : new WorkspaceCreationSettings({ id: 's', selfService: panelSelfService })),
      save: async () => {},
    };
    const policy = new ResolveWorkspaceCreationPolicy(settings, environmentSelfService);
    return new GetUserProfileQuery(users, undefined, policy).execute({ userId });
  };

  beforeEach(() => {
    users = new MockUserRepository();
    seedUser('root', true);
    seedUser('user', false);
  });

  it('lets a system admin create workspaces', async () => {
    expect((await profile('root', null)).capabilities.createWorkspace).toBe(true);
  });

  it('does not let a regular user by default', async () => {
    expect((await profile('user', null)).capabilities.createWorkspace).toBe(false);
  });

  it('lets a regular user when self-service is on, from the panel or the environment', async () => {
    expect((await profile('user', true)).capabilities.createWorkspace).toBe(true);
    expect((await profile('user', null, true)).capabilities.createWorkspace).toBe(true);
  });

  it('follows the environment over the panel', async () => {
    expect((await profile('user', true, false)).capabilities.createWorkspace).toBe(false);
  });
});
