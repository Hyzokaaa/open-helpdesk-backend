import { UpdateSystemAnalyticsSettings } from '../../../src/config/domain/services/system-analytics-update';
import { AnalyticsProvider } from '../../../src/config/domain/enums/analytics-provider.enum';
import { DomainValidationError } from '../../../src/shared/domain/errors';
import { MockSystemAnalyticsSettingsRepository } from '../../mocks/mock-system-analytics-settings.repository';
import { FakeIdGenerator } from '../../mocks/fake-id-generator';

describe('UpdateSystemAnalyticsSettings', () => {
  let repository: MockSystemAnalyticsSettingsRepository;
  let service: UpdateSystemAnalyticsSettings;

  const matomo = { provider: AnalyticsProvider.MATOMO, serverUrl: 'https://stats.example.com/', siteId: '3' };

  beforeEach(() => {
    repository = new MockSystemAnalyticsSettingsRepository();
    service = new UpdateSystemAnalyticsSettings(repository, new FakeIdGenerator());
  });

  it('enables Matomo with valid settings and persists them with defaults', async () => {
    const { before, after } = await service.execute(matomo);

    expect(before).toEqual({ provider: null, serverUrl: null, siteId: null, useCookies: false, trackEvents: true });
    expect(after).toEqual({
      provider: AnalyticsProvider.MATOMO,
      serverUrl: 'https://stats.example.com/',
      siteId: '3',
      useCookies: false,
      trackEvents: true,
    });
    const stored = await repository.find();
    expect(stored?.provider).toBe(AnalyticsProvider.MATOMO);
    expect(stored?.id).toBe('test-id-1');
  });

  it('normalises the server URL to origin and path with a trailing slash', async () => {
    const { after } = await service.execute({ ...matomo, serverUrl: '  https://Stats.Example.com:443/matomo  ', siteId: ' 12 ' });
    expect(after.serverUrl).toBe('https://stats.example.com/matomo/');
    expect(after.siteId).toBe('12');
  });

  it('adds the trailing slash to a bare origin', async () => {
    const { after } = await service.execute({ ...matomo, serverUrl: 'https://stats.example.com' });
    expect(after.serverUrl).toBe('https://stats.example.com/');
  });

  it.each([
    ['http://stats.example.com/', 'https'],
    ['javascript:alert(1)', 'https'],
    ['not a url', 'not a valid URL'],
    ['', 'required'],
    ['https://user:pass@stats.example.com/', 'credentials'],
    ['https://user@stats.example.com/', 'credentials'],
    ['https://stats.example.com/?a=1', 'query'],
    ['https://stats.example.com/#top', 'fragment'],
  ])('rejects the server URL %p', async (serverUrl, message) => {
    const attempt = service.execute({ ...matomo, serverUrl });
    await expect(attempt).rejects.toThrow(DomainValidationError);
    await expect(attempt).rejects.toThrow(message);
    expect(await repository.find()).toBeNull();
  });

  it.each(['abc', '0', '-1', '1.5', '12345678901', '01', ''])('rejects the site ID %p', async (siteId) => {
    await expect(service.execute({ ...matomo, siteId })).rejects.toThrow(DomainValidationError);
    expect(await repository.find()).toBeNull();
  });

  it('accepts a 10-digit site ID', async () => {
    const { after } = await service.execute({ ...matomo, siteId: '1234567890' });
    expect(after.siteId).toBe('1234567890');
  });

  it('requires a server URL and a site ID for Matomo', async () => {
    await expect(service.execute({ provider: AnalyticsProvider.MATOMO })).rejects.toThrow('Server URL is required');
    await expect(service.execute({ provider: AnalyticsProvider.MATOMO, serverUrl: 'https://stats.example.com/' }))
      .rejects.toThrow('Site ID is required');
  });

  it('applies a partial patch on top of the stored settings', async () => {
    await service.execute(matomo);
    const { before, after } = await service.execute({ useCookies: true, trackEvents: false });

    expect(before.useCookies).toBe(false);
    expect(after).toEqual({
      provider: AnalyticsProvider.MATOMO,
      serverUrl: 'https://stats.example.com/',
      siteId: '3',
      useCookies: true,
      trackEvents: false,
    });
  });

  it('leaves the stored settings untouched when a patch is invalid', async () => {
    await service.execute(matomo);
    await expect(service.execute({ siteId: 'x' })).rejects.toThrow(DomainValidationError);
    expect((await repository.find())?.siteId).toBe('3');
  });

  it('turns analytics off and clears the other fields', async () => {
    await service.execute({ ...matomo, useCookies: true, trackEvents: false });
    const { before, after } = await service.execute({ provider: null, serverUrl: 'http://ignored' });

    expect(before.provider).toBe(AnalyticsProvider.MATOMO);
    expect(after).toEqual({ provider: null, serverUrl: null, siteId: null, useCookies: false, trackEvents: true });
    expect((await repository.find())?.id).toBe('test-id-1');
  });

  it('rejects an unknown provider', async () => {
    await expect(service.execute({ ...matomo, provider: 'umami' as AnalyticsProvider })).rejects.toThrow('Unsupported');
  });
});
