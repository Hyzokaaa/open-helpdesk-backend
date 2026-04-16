import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserModel } from '../../user/infrastructure/typeorm/models/user.model';
import { BcryptPasswordHasher } from './bcrypt-password-hasher';
import { UlidGenerator } from './ulid-generator';

@Injectable()
export class SeederService implements OnModuleInit {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    @InjectRepository(UserModel)
    private readonly userRepository: Repository<UserModel>,
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

    await this.userRepository.save(user);
    this.logger.log(`Admin user created: ${email}`);
  }
}
