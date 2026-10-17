import { VerifyEmailCommand } from '../../../../src/user/application/commands/verify-email.command';
import { VerifyEmail } from '../../../../src/user/domain/services/user-verify-email';
import { User } from '../../../../src/user/domain/entities/user';
import { CreateAuditLogEntry } from '../../../../src/audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../src/audit-log/domain/enums/audit-action.enum';
import { InvalidCredentialsError } from '../../../../src/shared/domain/errors';
import { MockUserRepository } from '../../../mocks/mock-user.repository';
import { MockAuditLogRepository } from '../../../mocks/mock-audit-log.repository';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';

const tokens = {
  verify: (token: string) => {
    if (token === 'valid') return { sub: 'user-1', type: 'email-verification' };
    if (token === 'reset') return { sub: 'user-1', type: 'password-reset' };
    throw new Error('expired');
  },
} as any;

describe('VerifyEmailCommand', () => {
  let users: MockUserRepository;
  let audit: MockAuditLogRepository;
  const command = () => new VerifyEmailCommand(new VerifyEmail(users), tokens, new CreateAuditLogEntry(new FakeIdGenerator(), audit));

  beforeEach(() => {
    users = new MockUserRepository();
    audit = new MockAuditLogRepository();
    users.seed(new User({
      id: 'user-1', email: 'a@x.com', password: 'x', firstName: 'A', lastName: '', isActive: true,
      isSystemAdmin: false, isEmailVerified: false, language: 'en', theme: 'system',
    }));
  });

  it('verifies once and records it once, with who opened the link, however many times it is opened', async () => {
    const client = { ip: '10.0.0.1', forwardedFor: null, userAgent: 'Mozilla/5.0' };
    await command().execute({ token: 'valid', client });
    await command().execute({ token: 'valid', client });
    await command().execute({ token: 'valid' });

    expect((await users.findById('user-1'))!.isEmailVerified).toBe(true);
    const verified = audit.entries.filter((e) => e.action === AuditAction.USER_EMAIL_VERIFIED);
    expect(verified).toHaveLength(1);
    expect(verified[0].metadata).toMatchObject({ client });
  });

  it('rejects an expired token and a token made for something else', async () => {
    await expect(command().execute({ token: 'expired' })).rejects.toThrow(InvalidCredentialsError);
    await expect(command().execute({ token: 'reset' })).rejects.toThrow(InvalidCredentialsError);
    expect(audit.entries).toHaveLength(0);
  });
});
