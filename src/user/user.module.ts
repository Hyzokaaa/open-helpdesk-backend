import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { UserModel } from './infrastructure/typeorm/models/user.model';
import { TypeOrmUserRepository } from './infrastructure/typeorm/repositories/typeorm-user.repository';
import { AuthController } from './infrastructure/nest/controllers/auth.controller';
import { UserController } from './infrastructure/nest/controllers/user.controller';

@Module({
  imports: [SharedModule, TypeOrmModule.forFeature([UserModel])],
  controllers: [AuthController, UserController],
  providers: [TypeOrmUserRepository],
  exports: [TypeOrmUserRepository],
})
export class UserModule {}
