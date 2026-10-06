import {
  normalizeMatomoServerUrl,
  normalizeMatomoSiteId,
} from '../../../src/config/domain/services/matomo-settings-validation';
import { DomainValidationError } from '../../../src/shared/domain/errors';

describe('normalizeMatomoServerUrl', () => {
  it.each([
    ['https://stats.example.com', 'https://stats.example.com/'],
    ['  https://Stats.Example.com:443/matomo  ', 'https://stats.example.com/matomo/'],
    ['https://stats.example.com:8443/m/', 'https://stats.example.com:8443/m/'],
  ])('normalises %p to %p', (input, expected) => {
    expect(normalizeMatomoServerUrl(input)).toBe(expected);
  });

  it.each([
    [null, 'required'],
    [undefined, 'required'],
    ['   ', 'required'],
    ['not a url', 'not a valid URL'],
    ['http://stats.example.com/', 'https'],
    ['javascript:alert(1)', 'https'],
    ['https://user:pass@stats.example.com/', 'credentials'],
    ['https://stats.example.com/?a=1', 'query'],
    ['https://stats.example.com/#top', 'fragment'],
  ])('rejects %p', (input, message) => {
    expect(() => normalizeMatomoServerUrl(input)).toThrow(DomainValidationError);
    expect(() => normalizeMatomoServerUrl(input)).toThrow(message);
  });
});

describe('normalizeMatomoSiteId', () => {
  it('trims and accepts a positive integer of up to 10 digits', () => {
    expect(normalizeMatomoSiteId(' 7 ')).toBe('7');
    expect(normalizeMatomoSiteId('1234567890')).toBe('1234567890');
  });

  it.each([[null], [''], ['0'], ['07'], ['-1'], ['1.5'], ['abc'], ['12345678901']])('rejects %p', (input) => {
    expect(() => normalizeMatomoSiteId(input)).toThrow(DomainValidationError);
  });
});
