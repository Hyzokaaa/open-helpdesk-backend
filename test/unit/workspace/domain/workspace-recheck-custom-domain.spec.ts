import { Workspace } from '../../../../src/workspace/domain/entities/workspace';
import { RecheckCustomDomain } from '../../../../src/workspace/domain/services/workspace-recheck-custom-domain';
import { isCustomDomainTrusted } from '../../../../src/workspace/domain/services/workspace-custom-domain-trust';
import { MockWorkspaceRepository } from '../../../mocks/mock-workspace.repository';

describe('RecheckCustomDomain', () => {
  let workspaces: MockWorkspaceRepository;
  let pointsHere: boolean;
  let recheck: RecheckCustomDomain;
  const day = (n: number) => new Date(Date.UTC(2026, 9, n, 5));

  const seed = () => {
    const workspace = new Workspace({ id: 'ws-1', name: 'Acme', slug: 'acme', description: '', customDomain: 'soporte.acme.test', customDomainVerified: true });
    workspaces.seed(workspace);
    return workspace;
  };

  beforeEach(() => {
    workspaces = new MockWorkspaceRepository();
    pointsHere = true;
    recheck = new RecheckCustomDomain(workspaces, async () => pointsHere);
  });

  it('leaves a domain that still points here untouched', async () => {
    const workspace = seed();

    await expect(recheck.execute(workspace, day(1))).resolves.toBe('ok');
    expect(isCustomDomainTrusted(workspace)).toBe(true);
  });

  it('distrusts a domain only after three failed checks in a row', async () => {
    const workspace = seed();
    pointsHere = false;

    await expect(recheck.execute(workspace, day(1))).resolves.toBe('started-failing');
    await expect(recheck.execute(workspace, day(2))).resolves.toBe('still-failing');
    expect(isCustomDomainTrusted(workspace)).toBe(true);

    await expect(recheck.execute(workspace, day(3))).resolves.toBe('distrusted');
    expect(isCustomDomainTrusted(workspace)).toBe(false);
    expect(workspace.customDomainVerified).toBe(true);
    expect(workspace.customDomainFailingSince).toEqual(day(1));

    await expect(recheck.execute(workspace, day(4))).resolves.toBe('still-distrusted');
  });

  it('forgets a one-off failure as soon as the domain points here again', async () => {
    const workspace = seed();
    pointsHere = false;
    await recheck.execute(workspace, day(1));
    await recheck.execute(workspace, day(2));
    await recheck.execute(workspace, day(3));

    pointsHere = true;
    await expect(recheck.execute(workspace, day(4))).resolves.toBe('recovered');

    expect(isCustomDomainTrusted(workspace)).toBe(true);
    expect(workspace.customDomainCheckFailures).toBe(0);
    expect(workspace.customDomainFailingSince).toBeNull();
  });
});
