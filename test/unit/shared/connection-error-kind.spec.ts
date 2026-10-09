import { connectionErrorKind } from '../../../src/shared/infrastructure/connection-error-kind';

const withProps = (message: string, props: Record<string, unknown>) => Object.assign(new Error(message), props);

// Shapes captured from imapflow, nodemailer and Node against Gmail and Carbonio (TODO #6 of the 2026-10-08 feedback)
describe('connectionErrorKind', () => {
  it('recognises a refused login whatever the server says', () => {
    expect(connectionErrorKind(withProps('Command failed', { responseText: 'AUTHENTICATE failed', authenticationFailed: true }))).toBe('auth-failed');
    expect(connectionErrorKind(withProps('Command failed', { responseText: 'Invalid credentials (Failure)', authenticationFailed: true }))).toBe('auth-failed');
    expect(connectionErrorKind(withProps('Invalid login: 535 5.7.8 Error: authentication failed', { code: 'EAUTH', responseCode: 535 }))).toBe('auth-failed');
  });

  it('recognises TLS spoken to a port that starts in plain text', () => {
    expect(connectionErrorKind(withProps('64720000:error:0A00010B:SSL routines:ssl3_get_record:wrong version number', { code: 'ERR_SSL_WRONG_VERSION_NUMBER' }))).toBe('tls-mismatch');
  });

  it('recognises plain text spoken to a port that expects TLS', () => {
    expect(connectionErrorKind(new Error('Failed to receive greeting from server in required time. Maybe should use TLS?'))).toBe('tls-required');
  });

  it('recognises a port where no mail server of this kind answers', () => {
    expect(connectionErrorKind(new Error('Failed to receive greeting from server in required time'))).toBe('wrong-port');
    expect(connectionErrorKind(withProps('Greeting never received', { code: 'ETIMEDOUT' }))).toBe('wrong-port');
  });

  it('recognises a misspelled host, a closed port and a server that never answers', () => {
    expect(connectionErrorKind(withProps('getaddrinfo ENOTFOUND mail.example.netwrk', { code: 'ENOTFOUND' }))).toBe('host-not-found');
    expect(connectionErrorKind(withProps('connect ECONNREFUSED 127.0.0.1:3143', { code: 'ECONNREFUSED' }))).toBe('refused');
    expect(connectionErrorKind(Object.assign(new AggregateError([withProps('connect ETIMEDOUT 142.250.27.108:143', { code: 'ETIMEDOUT' })], ''), { code: 'ETIMEDOUT' }))).toBe('timeout');
    expect(connectionErrorKind(withProps('Connection timeout', { code: 'ETIMEDOUT' }))).toBe('timeout');
  });

  it('recognises the same network failures when nodemailer files them under its own codes', () => {
    expect(connectionErrorKind(withProps('getaddrinfo ENOTFOUND mail.example.netwrk', { code: 'EDNS' }))).toBe('host-not-found');
    expect(connectionErrorKind(withProps('connect ECONNREFUSED ::1:2599', { code: 'ESOCKET' }))).toBe('refused');
  });

  it('recognises a certificate the server cannot prove', () => {
    expect(connectionErrorKind(withProps('self-signed certificate', { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' }))).toBe('certificate');
  });

  it('leaves anything else as unknown', () => {
    expect(connectionErrorKind(new Error('Something odd'))).toBe('unknown');
    expect(connectionErrorKind(null)).toBe('unknown');
  });
});
