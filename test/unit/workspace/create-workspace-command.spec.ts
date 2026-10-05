import { CreateWorkspaceCommand } from '../../../src/workspace/application/commands/create-workspace.command';
import { CreateWorkspace } from '../../../src/workspace/domain/services/workspace-create';
import { AddWorkspaceMember } from '../../../src/workspace/domain/services/workspace-add-member';
import { EnsureCanCreateWorkspace } from '../../../src/workspace/domain/services/workspace-ensure-can-create';
import { ResolveWorkspaceCreationPolicy } from '../../../src/workspace/domain/services/workspace-creation-policy-resolve';
import { UpdateWorkspaceCreationSettings } from '../../../src/workspace/domain/services/workspace-creation-settings-update';
import { WorkspaceCreationSettings } from '../../../src/workspace/domain/entities/workspace-creation-settings';
import { WorkspaceCreationSettingsRepository } from '../../../src/workspace/domain/repositories/workspace-creation-settings.repository';
import { CreateAuditLogEntry } from '../../../src/audit-log/domain/services/audit-log-create';
import { AccessDeniedError, ConflictError } from '../../../src/shared/domain/errors';
import { MockWorkspaceRepository } from '../../mocks/mock-workspace.repository';
import { MockWorkspaceMemberRepository } from '../../mocks/mock-workspace-member.repository';
import { FakeIdGenerator } from '../../mocks/fake-id-generator';

class InMemorySettings implements WorkspaceCreationSettingsRepository {
  settings: WorkspaceCreationSettings | null = null;
  async find() { return this.settings; }
  async save(s: WorkspaceCreationSettings) { this.settings = s; }
}

describe('workspace creation', () => {
  let workspaces: MockWorkspaceRepository;
  let settings: InMemorySettings;

  const command = (environmentSelfService: boolean | null) => {
    const ids = new FakeIdGenerator();
    const policy = new ResolveWorkspaceCreationPolicy(settings, environmentSelfService);
    return new CreateWorkspaceCommand(
      new CreateWorkspace(ids, workspaces),
      new EnsureCanCreateWorkspace(policy),
      new AddWorkspaceMember(ids, new MockWorkspaceMemberRepository()),
      new CreateAuditLogEntry(ids, { create: async () => {} } as any),
    );
  };
  const create = (cmd: CreateWorkspaceCommand, creatorIsSystemAdmin: boolean) =>
    cmd.execute({ name: 'Mine', description: '', creatorUserId: 'user-1', creatorIsSystemAdmin });

  beforeEach(() => {
    workspaces = new MockWorkspaceRepository();
    settings = new InMemorySettings();
  });

  describe('CreateWorkspaceCommand', () => {
    it('does not let a regular user create a workspace by default', async () => {
      await expect(create(command(null), false)).rejects.toThrow(AccessDeniedError);
      expect(await workspaces.findAll()).toHaveLength(0);
    });

    it('always lets a system admin create a workspace', async () => {
      await expect(create(command(false), true)).resolves.toMatchObject({ slug: 'mine' });
    });

    it('lets a regular user create one when the admin panel allows it', async () => {
      settings.settings = new WorkspaceCreationSettings({ id: 's-1', selfService: true });

      await expect(create(command(null), false)).resolves.toMatchObject({ slug: 'mine' });
    });

    it('lets a regular user create one when the environment allows it', async () => {
      await expect(create(command(true), false)).resolves.toMatchObject({ slug: 'mine' });
    });

    it('follows the environment over the admin panel', async () => {
      settings.settings = new WorkspaceCreationSettings({ id: 's-1', selfService: true });

      await expect(create(command(false), false)).rejects.toThrow(AccessDeniedError);
    });
  });

  describe('UpdateWorkspaceCreationSettings', () => {
    const update = (environmentSelfService: boolean | null, selfService: boolean) => {
      const policy = new ResolveWorkspaceCreationPolicy(settings, environmentSelfService);
      return new UpdateWorkspaceCreationSettings(settings, new FakeIdGenerator(), policy).execute({ selfService });
    };

    it('saves the choice when the environment leaves it to the panel', async () => {
      await expect(update(null, true)).resolves.toEqual({ selfService: true, lockedByEnvironment: false });
      expect(settings.settings!.selfService).toBe(true);
    });

    it('refuses to change it when the environment fixes it', async () => {
      await expect(update(true, false)).rejects.toThrow(ConflictError);
      expect(settings.settings).toBeNull();
    });
  });
});
