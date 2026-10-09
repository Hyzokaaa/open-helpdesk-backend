import { UpdateWorkspaceDefaultLanguage } from '../../../../src/workspace/domain/services/workspace-update-default-language';
import { Workspace } from '../../../../src/workspace/domain/entities/workspace';
import { DomainValidationError } from '../../../../src/shared/domain/errors';
import { MockWorkspaceRepository } from '../../../mocks/mock-workspace.repository';

describe('The language of emails to people without an account', () => {
  let workspaces: MockWorkspaceRepository;

  beforeEach(() => {
    workspaces = new MockWorkspaceRepository();
    workspaces.seed(new Workspace({ id: 'ws-1', name: 'Support', slug: 'support', description: '' }));
  });

  it('starts unset on an existing workspace and is set to a supported language', async () => {
    const result = await new UpdateWorkspaceDefaultLanguage(workspaces).execute({ workspaceId: 'ws-1', language: 'es' });
    expect(result).toEqual({ before: null, after: 'es' });
    expect((await workspaces.findById('ws-1'))!.defaultLanguage).toBe('es');
  });

  it('refuses a language emails are not written in', async () => {
    await expect(new UpdateWorkspaceDefaultLanguage(workspaces).execute({ workspaceId: 'ws-1', language: 'fr' }))
      .rejects.toThrow(DomainValidationError);
  });
});
