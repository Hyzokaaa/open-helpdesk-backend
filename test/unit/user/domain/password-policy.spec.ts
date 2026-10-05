import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChangePassword } from '../../../../src/user/domain/services/user-change-password';
import { ResetPassword } from '../../../../src/user/domain/services/user-reset-password';
import { CreateUser } from '../../../../src/user/domain/services/user-create';
import { User } from '../../../../src/user/domain/entities/user';
import { isPasswordAcceptable } from '../../../../src/user/domain/password-policy';
import { DomainValidationError } from '../../../../src/shared/domain/errors';
import { ChangePasswordRequest } from '../../../../src/user/infrastructure/nest/dto/change-password.request';
import { ResetPasswordRequest } from '../../../../src/user/infrastructure/nest/dto/reset-password.request';
import { SignupUserRequest } from '../../../../src/user/infrastructure/nest/dto/signup-user.request';
import { RegisterUserRequest } from '../../../../src/user/infrastructure/nest/dto/register-user.request';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';
import { FakePasswordHasher } from '../../../mocks/fake-password-hasher';
import { MockUserRepository } from '../../../mocks/mock-user.repository';

function seedUser(repository: MockUserRepository): void {
  repository.seed(new User({
    id: 'user-1', email: 'ana@example.com', password: 'hashed:old-pass', firstName: 'Ana', lastName: 'B',
    isActive: true, isSystemAdmin: false, isEmailVerified: true, language: 'en', theme: 'system',
  }));
}

describe('password policy', () => {
  describe('rule', () => {
    it('accepts 8 to 128 characters', () => {
      expect(isPasswordAcceptable('12345678')).toBe(true);
      expect(isPasswordAcceptable('a'.repeat(128))).toBe(true);
    });

    it('rejects short, oversized, whitespace-only and non-string values', () => {
      expect(isPasswordAcceptable('1234567')).toBe(false);
      expect(isPasswordAcceptable('a'.repeat(129))).toBe(false);
      expect(isPasswordAcceptable('          ')).toBe(false);
      expect(isPasswordAcceptable(undefined)).toBe(false);
      expect(isPasswordAcceptable(12345678)).toBe(false);
    });
  });

  describe('domain services', () => {
    let repository: MockUserRepository;

    beforeEach(() => {
      repository = new MockUserRepository();
      seedUser(repository);
    });

    it('ChangePassword refuses a one-character password and keeps the old one', async () => {
      const service = new ChangePassword(repository, new FakePasswordHasher());

      await expect(
        service.execute({ userId: 'user-1', currentPassword: 'old-pass', newPassword: 'a' }),
      ).rejects.toThrow(DomainValidationError);
      expect((await repository.findById('user-1'))!.password).toBe('hashed:old-pass');
    });

    it('ResetPassword refuses an empty password and keeps the old one', async () => {
      const service = new ResetPassword(repository, new FakePasswordHasher());

      await expect(service.execute({ userId: 'user-1', newPassword: '' })).rejects.toThrow(DomainValidationError);
      expect((await repository.findById('user-1'))!.password).toBe('hashed:old-pass');
    });

    it('CreateUser refuses a short password and creates nothing', async () => {
      const service = new CreateUser(new FakeIdGenerator(), repository, new FakePasswordHasher());

      await expect(
        service.execute({ email: 'new@example.com', password: '123456', firstName: 'N', lastName: 'U' }),
      ).rejects.toThrow(DomainValidationError);
      expect(await repository.findByEmail('new@example.com')).toBeNull();
    });

    it('CreateUser still accepts the long random passwords generated for auto-created accounts', async () => {
      const service = new CreateUser(new FakeIdGenerator(), repository, new FakePasswordHasher());
      const user = await service.execute({ email: 'auto@example.com', password: 'f'.repeat(64), firstName: 'A', lastName: '' });
      expect(user.email).toBe('auto@example.com');
    });
  });

  describe('request DTOs', () => {
    it('reject a weak new password on change and reset (bodies were untyped before)', async () => {
      const change = plainToInstance(ChangePasswordRequest, { currentPassword: 'old', newPassword: 'a' });
      const reset = plainToInstance(ResetPasswordRequest, { token: 't', newPassword: '   ' });
      expect((await validate(change)).map((e) => e.property)).toEqual(['newPassword']);
      expect((await validate(reset)).map((e) => e.property)).toEqual(['newPassword']);
    });

    it('apply the same rule on signup and register', async () => {
      const base = { email: 'a@b.co', firstName: 'A', lastName: 'B' };
      const signup = plainToInstance(SignupUserRequest, { ...base, password: '123456', invitationToken: 'x' });
      const register = plainToInstance(RegisterUserRequest, { ...base, password: '123456' });
      expect((await validate(signup)).map((e) => e.property)).toEqual(['password']);
      expect((await validate(register)).map((e) => e.property)).toEqual(['password']);
    });

    it('accept a password that meets the rule', async () => {
      const reset = plainToInstance(ResetPasswordRequest, { token: 't', newPassword: 'long enough' });
      expect(await validate(reset)).toHaveLength(0);
    });
  });
});
