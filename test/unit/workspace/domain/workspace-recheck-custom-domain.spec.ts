import { Workspace } from '../../../../src/workspace/domain/entities/workspace';
import { RecheckCustomDomain } from '../../../../src/workspace/domain/services/workspace-recheck-custom-domain';
import { isCustomDomainTrusted } from '../../../../src/workspace/domain/services/workspace-custom-domain-trust';
import { MockWorkspaceRepository } from '../../../mocks/mock-workspace.repository';

describe('RecheckCustomDomain', () => {
  let workspaces: MockWorkspaceRepository;
  let pointsHere: boolean;
  let publishedRecord: string | null;
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
    publishedRecord = null;
    recheck = new RecheckCustomDomain(workspaces, async () => pointsHere, async (_domain, token) => token === publishedRecord);
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

  it('keeps trusting a domain behind a proxy that still publishes its verification record', async () => {
    const workspace = seed();
    workspace.domainVerificationToken = 'oh-verify=abc';
    pointsHere = false;
    publishedRecord = 'oh-verify=abc';

    await expect(recheck.execute(workspace, day(1))).resolves.toBe('ok');
    expect(isCustomDomainTrusted(workspace)).toBe(true);
  });

  it('gives the trust back to a distrusted domain whose record is found, and only its own record counts', async () => {
    const workspace = seed();
    workspace.domainVerificationToken = 'oh-verify=abc';
    pointsHere = false;
    publishedRecord = 'oh-verify=someone-else';
    for (const n of [1, 2, 3]) await recheck.execute(workspace, day(n));
    expect(isCustomDomainTrusted(workspace)).toBe(false);

    publishedRecord = 'oh-verify=abc';
    await expect(recheck.execute(workspace, day(4))).resolves.toBe('recovered');
    expect(isCustomDomainTrusted(workspace)).toBe(true);
  });

  it('has no record to look for on a domain added without DNS checks', async () => {
    const workspace = seed();
    pointsHere = false;
    publishedRecord = null;

    await expect(recheck.execute(workspace, day(1))).resolves.toBe('started-failing');
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
