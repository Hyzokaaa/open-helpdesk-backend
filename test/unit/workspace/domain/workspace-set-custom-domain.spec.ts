import { SetCustomDomain } from '../../../../src/workspace/domain/services/workspace-set-custom-domain';
import { Workspace } from '../../../../src/workspace/domain/entities/workspace';
import { AccessDeniedError } from '../../../../src/shared/domain/errors';
import { MockWorkspaceRepository } from '../../../mocks/mock-workspace.repository';

describe('SetCustomDomain', () => {
  let repository: MockWorkspaceRepository;
  let service: SetCustomDomain;

  beforeEach(async () => {
    repository = new MockWorkspaceRepository();
    service = new SetCustomDomain(repository, 'app.example.com');
    await repository.create(new Workspace({
      id: 'ws-acme', name: 'Acme', slug: 'acme', description: '',
      customDomain: 'support.acme.com', customDomainVerified: true,
    }));
    await repository.create(new Workspace({ id: 'ws-other', name: 'Other', slug: 'other', description: '' }));
  });

  async function verifiedSlugsOn(domain: string): Promise<string[]> {
    return (await repository.findByCustomDomain(domain)).filter((w) => w.customDomainVerified).map((w) => w.slug);
  }

  it('does not let a workspace attach itself, verified, to a domain it has not proven it controls', async () => {
    await expect(
      service.execute({ workspaceId: 'ws-other', domain: 'support.acme.com', autoVerify: true, isSystemAdmin: false }),
    ).rejects.toThrow(AccessDeniedError);

    expect(await verifiedSlugsOn('support.acme.com')).toEqual(['acme']);
  });

  it('leaves a domain pending with its own DNS token when it is set without skipping verification', async () => {
    const workspace = await service.execute({ workspaceId: 'ws-other', domain: 'Support.Acme.com' });

    expect(workspace.customDomain).toBe('support.acme.com');
    expect(workspace.customDomainVerified).toBe(false);
    expect(workspace.domainVerificationToken).toMatch(/^oh-verify=[0-9a-f]{32}$/);
    expect(await verifiedSlugsOn('support.acme.com')).toEqual(['acme']);
  });

  it('lets a system admin mark a domain verified without the DNS proof', async () => {
    const workspace = await service.execute({ workspaceId: 'ws-other', domain: 'help.other.com', autoVerify: true, isSystemAdmin: true });

    expect(workspace.customDomainVerified).toBe(true);
    expect(workspace.domainVerificationToken).toBeNull();
  });

  it('lets a workspace admin remove its domain', async () => {
    const workspace = await service.execute({ workspaceId: 'ws-acme', domain: null });

    expect(workspace.customDomain).toBeNull();
    expect(workspace.customDomainVerified).toBe(false);
  });
});
