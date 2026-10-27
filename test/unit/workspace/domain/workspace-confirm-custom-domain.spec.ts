import { Workspace } from '../../../../src/workspace/domain/entities/workspace';
import { ConfirmCustomDomain } from '../../../../src/workspace/domain/services/workspace-confirm-custom-domain';
import { RecheckCustomDomain } from '../../../../src/workspace/domain/services/workspace-recheck-custom-domain';
import { isCustomDomainTrusted } from '../../../../src/workspace/domain/services/workspace-custom-domain-trust';
import { DomainValidationError, EntityNotFoundError } from '../../../../src/shared/domain/errors';
import { MockWorkspaceRepository } from '../../../mocks/mock-workspace.repository';

describe('ConfirmCustomDomain', () => {
  let workspaces: MockWorkspaceRepository;
  let pointsHere: boolean;
  let publishedRecord: string | null;
  let confirm: ConfirmCustomDomain;
  let recheck: RecheckCustomDomain;
  const day = (n: number) => new Date(Date.UTC(2026, 9, n, 5));

  const seed = (props: Partial<ConstructorParameters<typeof Workspace>[0]> = {}) => {
    const workspace = new Workspace({
      id: 'ws-1', name: 'Acme', slug: 'acme', description: '',
      customDomain: 'soporte.acme.test', customDomainVerified: true, domainVerificationToken: 'oh-verify=abc',
      ...props,
    });
    workspaces.seed(workspace);
    return workspace;
  };

  /** The daily check failing `days` times in a row, as it did for a domain behind a proxy. */
  const failDays = async (workspace: Workspace, days: number) => {
    const before = { pointsHere, publishedRecord };
    pointsHere = false;
    publishedRecord = null;
    for (let n = 1; n <= days; n++) await recheck.execute(workspace, day(n));
    ({ pointsHere, publishedRecord } = before);
  };

  beforeEach(() => {
    workspaces = new MockWorkspaceRepository();
    pointsHere = false;
    publishedRecord = null;
    const points = async () => pointsHere;
    const keeps = async (_domain: string, token: string) => token === publishedRecord;
    confirm = new ConfirmCustomDomain(workspaces, points, keeps);
    recheck = new RecheckCustomDomain(workspaces, points, keeps);
  });

  it('gives the trust back to a distrusted domain that still publishes its record', async () => {
    const workspace = seed();
    await failDays(workspace, 5);
    expect(isCustomDomainTrusted(workspace)).toBe(false);
    publishedRecord = 'oh-verify=abc';

    const result = await confirm.execute({ workspaceId: 'ws-1' });

    expect(result).toEqual({ domain: 'soporte.acme.test', trusted: true, recovered: true, dnsValid: false, txtValid: true });
    const saved = (await workspaces.findById('ws-1'))!;
    expect(saved.customDomainCheckFailures).toBe(0);
    expect(saved.customDomainFailingSince).toBeNull();
    expect(isCustomDomainTrusted(saved)).toBe(true);
  });

  it('gives the trust back when the domain points here again', async () => {
    const workspace = seed();
    await failDays(workspace, 3);
    pointsHere = true;

    await expect(confirm.execute({ workspaceId: 'ws-1' })).resolves.toMatchObject({ trusted: true, recovered: true, dnsValid: true });
  });

  it('starts the count over for a domain that was failing but still trusted', async () => {
    const workspace = seed();
    await failDays(workspace, 2);
    expect(isCustomDomainTrusted(workspace)).toBe(true);
    pointsHere = true;

    await expect(confirm.execute({ workspaceId: 'ws-1' })).resolves.toMatchObject({ trusted: true, recovered: true });
    expect(workspace.customDomainCheckFailures).toBe(0);
  });

  it('never counts a failure, however many times it is pressed', async () => {
    const workspace = seed();
    await failDays(workspace, 1);

    for (let i = 0; i < 5; i++) {
      await expect(confirm.execute({ workspaceId: 'ws-1' })).resolves.toEqual({
        domain: 'soporte.acme.test', trusted: true, recovered: false, dnsValid: false, txtValid: false,
      });
    }
    expect(workspace.customDomainCheckFailures).toBe(1);
    expect(workspace.customDomainFailingSince).toEqual(day(1));
  });

  it('keeps a distrusted domain distrusted when nothing shows it is still ours', async () => {
    const workspace = seed();
    await failDays(workspace, 3);
    publishedRecord = 'oh-verify=someone-else';

    await expect(confirm.execute({ workspaceId: 'ws-1' })).resolves.toMatchObject({ trusted: false, recovered: false });
    expect(workspace.customDomainCheckFailures).toBe(3);
  });

  it('has no record to look for on a domain added without DNS checks', async () => {
    const workspace = seed({ domainVerificationToken: null });
    await failDays(workspace, 3);
    publishedRecord = 'oh-verify=abc';

    await expect(confirm.execute({ workspaceId: 'ws-1' })).resolves.toMatchObject({ trusted: false, txtValid: false });
  });

  it('changes nothing on a domain that never failed', async () => {
    const workspace = seed();
    pointsHere = true;
    const update = jest.spyOn(workspaces, 'update');

    await expect(confirm.execute({ workspaceId: 'ws-1' })).resolves.toMatchObject({ trusted: true, recovered: false });
    expect(update).not.toHaveBeenCalled();
    expect(workspace.customDomainCheckFailures).toBe(0);
  });

  it('refuses a domain that is not verified, or a workspace without one', async () => {
    seed({ customDomainVerified: false });
    await expect(confirm.execute({ workspaceId: 'ws-1' })).rejects.toThrow(DomainValidationError);

    workspaces = new MockWorkspaceRepository();
    confirm = new ConfirmCustomDomain(workspaces, async () => true, async () => true);
    seed({ customDomain: null, customDomainVerified: false });
    await expect(confirm.execute({ workspaceId: 'ws-1' })).rejects.toThrow(DomainValidationError);
    await expect(confirm.execute({ workspaceId: 'missing' })).rejects.toThrow(EntityNotFoundError);
  });
});
