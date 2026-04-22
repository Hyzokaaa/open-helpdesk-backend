import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UlidGenerator } from './infrastructure/ulid-generator';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher';
import { S3StorageService } from './infrastructure/s3-storage.service';
import { NestEventPublisher } from './infrastructure/nest-event-publisher';
import { JwtTokenService } from './infrastructure/jwt-token-service';
import { SeederService } from './infrastructure/seeder.service';
import { JwtStrategy } from './nest/strategies/jwt.strategy';
import { UserModel } from '../user/infrastructure/typeorm/models/user.model';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([UserModel]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET', 'default-secret'),
        signOptions: { expiresIn: config.get('JWT_EXPIRATION', '1d') },
      }),
    }),
  ],
  providers: [UlidGenerator, BcryptPasswordHasher, S3StorageService, NestEventPublisher, JwtTokenService, SeederService, JwtStrategy],
  exports: [UlidGenerator, BcryptPasswordHasher, S3StorageService, NestEventPublisher, JwtTokenService, JwtModule, PassportModule],
})
export class SharedModule {}
