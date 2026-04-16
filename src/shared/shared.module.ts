import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UlidGenerator } from './infrastructure/ulid-generator';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher';
import { S3StorageService } from './infrastructure/s3-storage.service';
import { JwtStrategy } from './nest/strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET', 'default-secret'),
        signOptions: { expiresIn: config.get('JWT_EXPIRATION', '1d') },
      }),
    }),
  ],
  providers: [UlidGenerator, BcryptPasswordHasher, S3StorageService, JwtStrategy],
  exports: [UlidGenerator, BcryptPasswordHasher, S3StorageService, JwtModule, PassportModule],
})
export class SharedModule {}
