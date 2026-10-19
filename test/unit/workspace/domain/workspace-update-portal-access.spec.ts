import { UpdateWorkspacePortalAccess } from '../../../../src/workspace/domain/services/workspace-update-portal-access';
import { ResolvePortalWorkspace } from '../../../../src/ticket/domain/services/portal-workspace-resolve';
import { ResolvePublicKbWorkspace } from '../../../../src/knowledge-base/domain/services/kb-public-workspace-resolve';
import { Workspace } from '../../../../src/workspace/domain/entities/workspace';
import { DomainValidationError, EntityNotFoundError, PortalClosedError } from '../../../../src/shared/domain/errors';
import { MockWorkspaceRepository } from '../../../mocks/mock-workspace.repository';

describe('Portal access', () => {
  let workspaces: MockWorkspaceRepository;
  let workspace: Workspace;

  beforeEach(() => {
    workspaces = new MockWorkspaceRepository();
    workspace = new Workspace({ id: 'ws', name: 'Acme', slug: 'acme', description: '' });
    workspaces.seed(workspace);
  });

  describe('UpdateWorkspacePortalAccess', () => {
    const update = () => new UpdateWorkspacePortalAccess(workspaces);

    it('starts with the portal and the knowledge base open, as before the setting existed', () => {
      expect(workspace.portalEnabled).toBe(true);
      expect(workspace.publicKbEnabled).toBe(true);
    });

    it('changes only what it is given and says what it was before', async () => {
      const closed = await update().execute({ workspaceId: 'ws', portalEnabled: false });
      expect(closed).toEqual({
        before: { portalEnabled: true, publicKbEnabled: true },
        after: { portalEnabled: false, publicKbEnabled: true },
      });

      const kbPrivate = await update().execute({ workspaceId: 'ws', publicKbEnabled: false });
      expect(kbPrivate.after).toEqual({ portalEnabled: false, publicKbEnabled: false });
      expect((await workspaces.findById('ws'))!.portalEnabled).toBe(false);
    });

    it('refuses a request that changes nothing, and an unknown workspace', async () => {
      await expect(update().execute({ workspaceId: 'ws' })).rejects.toThrow(DomainValidationError);
      await expect(update().execute({ workspaceId: 'nope', portalEnabled: false })).rejects.toThrow(EntityNotFoundError);
    });
  });

  describe('ResolvePortalWorkspace', () => {
    it('gives the workspace while its portal is open, a PortalClosedError once it is closed', async () => {
      expect((await new ResolvePortalWorkspace(workspaces).execute('acme')).getId()).toBe('ws');
      workspace.portalEnabled = false;
      await expect(new ResolvePortalWorkspace(workspaces).execute('acme')).rejects.toThrow(PortalClosedError);
      await expect(new ResolvePortalWorkspace(workspaces).execute('nope')).rejects.toThrow(EntityNotFoundError);
    });
  });

  describe('ResolvePublicKbWorkspace', () => {
    it('serves the knowledge base whatever the portal, and a private one as if it did not exist', async () => {
      workspace.portalEnabled = false;
      expect((await new ResolvePublicKbWorkspace(workspaces).execute('acme')).getId()).toBe('ws');

      workspace.publicKbEnabled = false;
      const error = await new ResolvePublicKbWorkspace(workspaces).execute('acme').catch((e) => e);
      expect(error).toBeInstanceOf(EntityNotFoundError);
      expect(error).not.toBeInstanceOf(PortalClosedError);
    });
  });
});
