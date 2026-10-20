import { KEEP_STORED_PASSWORD, PasswordRequiredError, ensureSavedPasswordStaysWithItsServer, passwordForConnectionTest } from '../../../src/shared/domain/stored-password';

describe('passwordForConnectionTest', () => {
  const stored = { host: 'mail.example.com', user: 'support@example.com', password: 'saved-secret' };

  it.each(['', null, undefined, KEEP_STORED_PASSWORD])('uses the saved password for the same server and user (typed %p)', (typed) => {
    expect(passwordForConnectionTest({ host: 'mail.example.com', user: 'support@example.com', password: typed }, stored)).toBe('saved-secret');
  });

  it('ignores case and surrounding spaces in the server and user', () => {
    expect(passwordForConnectionTest({ host: ' Mail.Example.com ', user: 'Support@Example.com', password: '' }, stored)).toBe('saved-secret');
  });

  it('never sends the saved password to another server', () => {
    expect(passwordForConnectionTest({ host: 'evil.example.net', user: 'support@example.com', password: KEEP_STORED_PASSWORD }, stored)).toBeNull();
  });

  it('asks for the password for another user', () => {
    expect(passwordForConnectionTest({ host: 'mail.example.com', user: 'other@example.com', password: '' }, stored)).toBeNull();
  });

  it('asks for the password when the server or user is missing', () => {
    expect(passwordForConnectionTest({ host: '', user: 'support@example.com', password: '' }, stored)).toBeNull();
    expect(passwordForConnectionTest({ host: 'mail.example.com', user: null, password: '' }, stored)).toBeNull();
  });

  it('asks for the password when nothing was saved', () => {
    expect(passwordForConnectionTest({ host: 'mail.example.com', user: 'support@example.com', password: '' }, null)).toBeNull();
    expect(passwordForConnectionTest({ host: 'mail.example.com', user: 'support@example.com', password: '' }, { ...stored, password: null })).toBeNull();
  });

  it.each([
    ['the same server', 'mail.example.com', 'support@example.com'],
    ['another server', 'other.example.net', 'someone@example.net'],
  ])('uses a typed password as it is, with %s', (_case, host, user) => {
    expect(passwordForConnectionTest({ host, user, password: 'typed-secret' }, stored)).toBe('typed-secret');
  });
});

describe('ensureSavedPasswordStaysWithItsServer', () => {
  const stored = { host: 'mail.example.com', user: 'support@example.com', password: 'saved-secret' };

  it.each(['', null, undefined, KEEP_STORED_PASSWORD])('keeps the saved password on the same server and user (typed %p)', (typed) => {
    expect(() => ensureSavedPasswordStaysWithItsServer({ host: 'MAIL.example.com ', user: 'support@example.com', password: typed }, stored)).not.toThrow();
  });

  it('refuses to keep it for another server', () => {
    expect(() => ensureSavedPasswordStaysWithItsServer({ host: 'evil.example.net', user: 'support@example.com', password: '' }, stored)).toThrow(PasswordRequiredError);
  });

  it('refuses to keep it for another user', () => {
    expect(() => ensureSavedPasswordStaysWithItsServer({ host: 'mail.example.com', user: 'other@example.com', password: KEEP_STORED_PASSWORD }, stored)).toThrow(PasswordRequiredError);
  });

  it('lets a new password go to any server', () => {
    expect(() => ensureSavedPasswordStaysWithItsServer({ host: 'other.example.net', user: 'other@example.net', password: 'new-secret' }, stored)).not.toThrow();
  });

  it('has nothing to guard when no password was saved', () => {
    expect(() => ensureSavedPasswordStaysWithItsServer({ host: 'other.example.net', user: 'x', password: '' }, null)).not.toThrow();
    expect(() => ensureSavedPasswordStaysWithItsServer({ host: 'other.example.net', user: 'x', password: '' }, { ...stored, password: '' })).not.toThrow();
  });
});
