import { connectionErrorDetail } from '../../../src/shared/infrastructure/connection-error-detail';

// Shapes captured from imapflow and Node against real servers (TODO #5 of the 2026-10-08 feedback)
describe('connectionErrorDetail', () => {
  it('explains a host whose addresses all time out, which Node reports with an empty message', () => {
    const err = Object.assign(new AggregateError([
      Object.assign(new Error('connect ETIMEDOUT 142.250.27.108:143'), { code: 'ETIMEDOUT' }),
      Object.assign(new Error('connect ETIMEDOUT 2a00:1450:4025:c03::6c:143'), { code: 'ETIMEDOUT' }),
    ], ''), { code: 'ETIMEDOUT' });

    expect(connectionErrorDetail(err)).toBe('connect ETIMEDOUT 142.250.27.108:143');
  });

  it('falls back to the error code when nothing else is said', () => {
    expect(connectionErrorDetail(Object.assign(new AggregateError([], ''), { code: 'ETIMEDOUT' }))).toBe('ETIMEDOUT');
  });

  it('adds what the server answered when imapflow only says "Command failed"', () => {
    const err = Object.assign(new Error('Command failed'), { responseText: 'Invalid credentials (Failure)', authenticationFailed: true });

    expect(connectionErrorDetail(err)).toBe('Command failed: Invalid credentials (Failure)');
  });

  it('keeps an error that already says what happened', () => {
    expect(connectionErrorDetail(new Error('getaddrinfo ENOTFOUND mail.example.netwrk'))).toBe('getaddrinfo ENOTFOUND mail.example.netwrk');
  });

  it('never returns an empty text', () => {
    for (const err of [new Error(''), {}, null, undefined, '', 42]) {
      expect(connectionErrorDetail(err)).not.toBe('');
    }
  });
});
