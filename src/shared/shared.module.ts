import { config } from 'dotenv';
config();

import { Module, type Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UlidGenerator } from './infrastructure/ulid-generator';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher';
import { S3StorageService } from './infrastructure/s3-storage.service';
import { FilesystemStorageService } from './infrastructure/filesystem-storage.service';
import { NestEventPublisher } from './infrastructure/nest-event-publisher';
import { JwtTokenService } from './infrastructure/jwt-token-service';
import { SeederService } from './infrastructure/seeder.service';
import { EventsGateway } from './infrastructure/ws/events.gateway';
import { JwtStrategy } from './nest/strategies/jwt.strategy';
import { StorageFileController } from './infrastructure/nest/controllers/storage-file.controller';
import { UserModel } from '../user/infrastructure/typeorm/models/user.model';
import { AccountModel } from '../account/infrastructure/typeorm/models/account.model';
import { StorageService } from './domain/storage-service';

export const STORAGE_SERVICE = 'STORAGE_SERVICE';

function buildOAuthProviders(): Provider[] {
  const providers: Provider[] = [];

  if (process.env.GOOGLE_CLIENT_ID) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GoogleStrategy } = require('./nest/strategies/google.strategy');
    providers.push(GoogleStrategy);
  }

  if (process.env.MICROSOFT_CLIENT_ID) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MicrosoftStrategy } = require('./nest/strategies/microsoft.strategy');
    providers.push(MicrosoftStrategy);
  }

  return providers;
}

const isFilesystem = process.env.STORAGE_PROVIDER === 'filesystem';

const storageProvider: Provider = {
  provide: STORAGE_SERVICE,
  useClass: isFilesystem ? FilesystemStorageService : S3StorageService,
};

const filesystemProvider: Provider = {
  provide: 'FILESYSTEM_STORAGE',
  useFactory: (config: ConfigService) => isFilesystem ? new FilesystemStorageService(config) : null,
  inject: [ConfigService],
};

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([UserModel, AccountModel]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRATION', '1d') },
      }),
    }),
  ],
  controllers: [StorageFileController],
  providers: [UlidGenerator, BcryptPasswordHasher, S3StorageService, FilesystemStorageService, storageProvider, filesystemProvider, NestEventPublisher, JwtTokenService, SeederService, JwtStrategy, EventsGateway, ...buildOAuthProviders()],
  exports: [UlidGenerator, BcryptPasswordHasher, S3StorageService, FilesystemStorageService, STORAGE_SERVICE, NestEventPublisher, JwtTokenService, JwtModule, PassportModule],
})
export class SharedModule {}
