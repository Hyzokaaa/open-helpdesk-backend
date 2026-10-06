import { UpdateWorkspaceAnalyticsSettings } from '../../../../src/workspace/domain/services/workspace-analytics-update';
import { AnalyticsProvider } from '../../../../src/config/domain/enums/analytics-provider.enum';
import { DomainValidationError } from '../../../../src/shared/domain/errors';
import { MockWorkspaceAnalyticsSettingsRepository } from '../../../mocks/mock-workspace-analytics-settings.repository';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';

describe('UpdateWorkspaceAnalyticsSettings', () => {
  let repository: MockWorkspaceAnalyticsSettingsRepository;
  let service: UpdateWorkspaceAnalyticsSettings;

  const matomo = { workspaceId: 'ws-1', provider: AnalyticsProvider.MATOMO, serverUrl: 'https://stats.acme.com', siteId: '4' };
  const defaults = { provider: null, serverUrl: null, siteId: null, useCookies: false, trackEvents: true, shareWithInstallation: true };

  beforeEach(() => {
    repository = new MockWorkspaceAnalyticsSettingsRepository();
    service = new UpdateWorkspaceAnalyticsSettings(repository, new FakeIdGenerator());
  });

  it('starts from the defaults and stores a valid Matomo configuration normalised', async () => {
    const { settings, before, after } = await service.execute(matomo);

    expect(before).toEqual(defaults);
    expect(after).toEqual({ ...defaults, provider: AnalyticsProvider.MATOMO, serverUrl: 'https://stats.acme.com/', siteId: '4' });
    const stored = await repository.findByWorkspaceId('ws-1');
    expect(stored?.getId()).toBe('test-id-1');
    expect(stored?.workspaceId).toBe('ws-1');
    expect(settings.serverUrl).toBe('https://stats.acme.com/');
  });

  it.each([
    [{ serverUrl: 'http://stats.acme.com/' }, 'https'],
    [{ serverUrl: 'https://u:p@stats.acme.com/' }, 'credentials'],
    [{ serverUrl: 'https://stats.acme.com/?x=1' }, 'query'],
    [{ serverUrl: null }, 'required'],
    [{ siteId: '0' }, 'positive integer'],
    [{ siteId: 'abc' }, 'positive integer'],
    [{ siteId: null }, 'required'],
  ])('rejects %p and stores nothing', async (patch, message) => {
    const attempt = service.execute({ ...matomo, ...patch });
    await expect(attempt).rejects.toThrow(DomainValidationError);
    await expect(attempt).rejects.toThrow(message);
    expect(await repository.findByWorkspaceId('ws-1')).toBeNull();
  });

  it('keeps the stored values of the fields a patch omits, and leaves them untouched when a patch is invalid', async () => {
    await service.execute({ ...matomo, useCookies: true, trackEvents: false });

    const { after } = await service.execute({ workspaceId: 'ws-1', siteId: '9' });
    expect(after).toMatchObject({ serverUrl: 'https://stats.acme.com/', siteId: '9', useCookies: true, trackEvents: false });

    await expect(service.execute({ workspaceId: 'ws-1', serverUrl: 'ftp://x' })).rejects.toThrow(DomainValidationError);
    expect((await repository.findByWorkspaceId('ws-1'))?.siteId).toBe('9');
  });

  it('turning the provider off clears the Matomo fields but keeps shareWithInstallation', async () => {
    await service.execute({ ...matomo, useCookies: true, trackEvents: false, shareWithInstallation: false });

    const { before, after } = await service.execute({ workspaceId: 'ws-1', provider: null, serverUrl: 'ignored' });

    expect(before).toMatchObject({ provider: AnalyticsProvider.MATOMO, shareWithInstallation: false });
    expect(after).toEqual({ ...defaults, shareWithInstallation: false });
  });

  it('changes shareWithInstallation alone, without a provider', async () => {
    const { after } = await service.execute({ workspaceId: 'ws-1', shareWithInstallation: false });
    expect(after).toEqual({ ...defaults, shareWithInstallation: false });
  });

  it('keeps each workspace apart', async () => {
    await service.execute(matomo);
    await service.execute({ workspaceId: 'ws-2', shareWithInstallation: false });

    expect((await repository.findByWorkspaceId('ws-1'))?.shareWithInstallation).toBe(true);
    expect((await repository.findByWorkspaceId('ws-2'))?.provider).toBeNull();
  });

  it('rejects an unknown provider', async () => {
    await expect(service.execute({ workspaceId: 'ws-1', provider: 'ga' as AnalyticsProvider })).rejects.toThrow('Unsupported');
  });
});
