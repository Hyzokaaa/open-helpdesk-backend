import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserModel } from '../../user/infrastructure/typeorm/models/user.model';
import { AccountModel } from '../../account/infrastructure/typeorm/models/account.model';
import { BcryptPasswordHasher } from './bcrypt-password-hasher';
import { UlidGenerator } from './ulid-generator';

@Injectable()
export class SeederService implements OnModuleInit {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    @InjectRepository(UserModel)
    private readonly userRepository: Repository<UserModel>,
    @InjectRepository(AccountModel)
    private readonly accountRepository: Repository<AccountModel>,
    private readonly config: ConfigService,
    private readonly passwordHasher: BcryptPasswordHasher,
    private readonly idGenerator: UlidGenerator,
  ) {}

  async onModuleInit() {
    await this.seedAdmin();
  }

  private async seedAdmin() {
    const email = this.config.get<string>('ADMIN_EMAIL');
    const password = this.config.get<string>('ADMIN_PASSWORD');

    if (!email || !password) {
      this.logger.log('ADMIN_EMAIL/ADMIN_PASSWORD not set, skipping admin seed');
      return;
    }

    const existing = await this.userRepository.findOneBy({ email });
    if (existing) {
      const hasAccount = await this.accountRepository.findOneBy({ ownerId: existing.id });
      if (!hasAccount) {
        const account = new AccountModel();
        account.id = this.idGenerator.create();
        account.ownerId = existing.id;
        account.name = `${existing.firstName}'s Account`;
        await this.accountRepository.save(account);
        this.logger.log(`Account created for existing admin: ${email}`);
      }
      this.logger.log(`Admin user already exists: ${email}`);
      return;
    }

    const hashedPassword = await this.passwordHasher.hash(password);
    const user = new UserModel();
    user.id = this.idGenerator.create();
    user.email = email;
    user.password = hashedPassword;
    user.firstName = 'System';
    user.lastName = 'Admin';
    user.isActive = true;
    user.isSystemAdmin = true;
    user.isEmailVerified = true;
    user.language = 'en';
    user.theme = 'system';

    await this.userRepository.save(user);

    const account = new AccountModel();
    account.id = this.idGenerator.create();
    account.ownerId = user.id;
    account.name = `${user.firstName}'s Account`;
    await this.accountRepository.save(account);

    this.logger.log(`Admin user created: ${email}`);
  }
}
