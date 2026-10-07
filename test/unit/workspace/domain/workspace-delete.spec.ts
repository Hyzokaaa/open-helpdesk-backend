import { DeleteWorkspace, WORKSPACE_RECOVERY_DAYS } from '../../../../src/workspace/domain/services/workspace-delete';
import { RestoreWorkspace } from '../../../../src/workspace/domain/services/workspace-restore';
import { PurgeWorkspace } from '../../../../src/workspace/domain/services/workspace-purge';
import { EnsureWorkspaceOwner } from '../../../../src/workspace/domain/services/workspace-ensure-owner';
import { Workspace } from '../../../../src/workspace/domain/entities/workspace';
import { Account } from '../../../../src/account/domain/entities/account';
import { AccessDeniedError, DomainValidationError, EntityNotFoundError } from '../../../../src/shared/domain/errors';
import { MockWorkspaceRepository } from '../../../mocks/mock-workspace.repository';
import { MockAccountRepository } from '../../../mocks/mock-account.repository';
import { FakeS3Storage } from '../../../mocks/fake-s3-storage';

describe('Deleting, restoring and purging a workspace', () => {
  let workspaces: MockWorkspaceRepository;
  let accounts: MockAccountRepository;
  let ensureOwner: EnsureWorkspaceOwner;
  const now = new Date('2026-10-07T10:00:00.000Z');

  beforeEach(async () => {
    workspaces = new MockWorkspaceRepository();
    accounts = new MockAccountRepository();
    await accounts.create(new Account({ id: 'acc-owner', ownerId: 'owner', name: 'Owner' }));
    workspaces.seed(new Workspace({ id: 'ws-1', name: 'Acme Support', slug: 'acme', description: '', accountId: 'acc-owner', logo: 'workspaces/ws-1/logo.png' }));
    workspaces.seed(new Workspace({ id: 'ws-legacy', name: 'Legacy', slug: 'legacy', description: '' }));
    ensureOwner = new EnsureWorkspaceOwner(accounts);
  });

  const del = (props: Partial<{ workspaceId: string; userId: string; isSystemAdmin: boolean; confirmName: string }>) =>
    new DeleteWorkspace(workspaces, ensureOwner).execute({
      workspaceId: 'ws-1', userId: 'owner', isSystemAdmin: false, confirmName: 'Acme Support', now, ...props,
    });

  describe('deleting', () => {
    it('lets the owner delete it, recoverably, for the recovery period', async () => {
      const { purgeAt } = await del({});

      expect(purgeAt.getTime() - now.getTime()).toBe(WORKSPACE_RECOVERY_DAYS * 24 * 60 * 60 * 1000);
      expect(await workspaces.findById('ws-1')).toBeNull();
      expect((await workspaces.findDeletedById('ws-1'))?.deletedById).toBe('owner');
      // The slug stays taken while it can still come back
      expect(await workspaces.existsBySlug('acme')).toBe(true);
    });

    it('lets a system admin delete any workspace, also one with no account', async () => {
      await expect(del({ workspaceId: 'ws-legacy', userId: 'root', isSystemAdmin: true, confirmName: 'legacy' })).resolves.toBeDefined();
    });

    it('refuses anyone else, an admin of the workspace included', async () => {
      await expect(del({ userId: 'workspace-admin' })).rejects.toThrow(AccessDeniedError);
      await expect(del({ workspaceId: 'ws-legacy', userId: 'owner', confirmName: 'Legacy' })).rejects.toThrow(AccessDeniedError);
      expect(await workspaces.findById('ws-1')).not.toBeNull();
    });

    it('requires the name typed to confirm, ignoring case and extra spaces', async () => {
      await expect(del({ confirmName: 'Acme' })).rejects.toThrow(DomainValidationError);
      await expect(del({ confirmName: '  acme   SUPPORT ' })).resolves.toBeDefined();
    });
  });

  describe('restoring', () => {
    it('brings it back exactly as it was, for its owner', async () => {
      await del({});
      const restored = await new RestoreWorkspace(workspaces, ensureOwner).execute({ workspaceId: 'ws-1', userId: 'owner', isSystemAdmin: false });

      expect(restored.slug).toBe('acme');
      expect(restored.deletedAt).toBeNull();
      expect(restored.purgeAt).toBeNull();
      expect(await workspaces.findById('ws-1')).not.toBeNull();
    });

    it('refuses anyone but its owner or a system admin', async () => {
      await del({});
      await expect(new RestoreWorkspace(workspaces, ensureOwner).execute({ workspaceId: 'ws-1', userId: 'someone', isSystemAdmin: false }))
        .rejects.toThrow(AccessDeniedError);
      await expect(new RestoreWorkspace(workspaces, ensureOwner).execute({ workspaceId: 'ws-1', userId: 'root', isSystemAdmin: true }))
        .resolves.toBeDefined();
    });

    it('only restores a deleted workspace', async () => {
      await expect(new RestoreWorkspace(workspaces, ensureOwner).execute({ workspaceId: 'ws-1', userId: 'owner', isSystemAdmin: false }))
        .rejects.toThrow(EntityNotFoundError);
    });
  });

  describe('purging', () => {
    it('erases a deleted workspace and its files, carrying on past a file that fails', async () => {
      await del({});
      const storage = new FakeS3Storage();
      storage.failingDeletes.add('attachments/a2/b.png');
      const fileKeys = { listFor: async () => ['attachments/a1/a.pdf', 'attachments/a2/b.png'] };

      const { filesDeleted } = await new PurgeWorkspace(workspaces, fileKeys, storage).execute({ workspaceId: 'ws-1' });

      expect(await workspaces.findDeletedById('ws-1')).toBeNull();
      expect(storage.deletedKeys).toEqual(['attachments/a1/a.pdf', 'attachments/a2/b.png', 'workspaces/ws-1/logo.png']);
      expect(filesDeleted).toBe(2);
      // Gone for good: the slug is free again
      expect(await workspaces.existsBySlug('acme')).toBe(false);
    });

    it('never purges a live workspace', async () => {
      const purge = new PurgeWorkspace(workspaces, { listFor: async () => [] }, new FakeS3Storage());
      await expect(purge.execute({ workspaceId: 'ws-1' })).rejects.toThrow(EntityNotFoundError);
      expect(await workspaces.findById('ws-1')).not.toBeNull();
    });

    it('finds what is due for purge and for the last reminder', async () => {
      await del({});
      const purgeAt = (await workspaces.findDeletedById('ws-1'))!.purgeAt!;
      const day = 24 * 60 * 60 * 1000;

      expect(await workspaces.findDueForPurge(new Date(purgeAt.getTime() - day))).toHaveLength(0);
      expect(await workspaces.findDueForPurge(purgeAt)).toHaveLength(1);
      expect(await workspaces.findDueForPurgeReminder(new Date(purgeAt.getTime() + day))).toHaveLength(1);
      await workspaces.markPurgeReminderSent('ws-1', now);
      expect(await workspaces.findDueForPurgeReminder(new Date(purgeAt.getTime() + day))).toHaveLength(0);
    });
  });
});
