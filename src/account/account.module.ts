import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountModel } from './infrastructure/typeorm/models/account.model';
import { TypeOrmAccountRepository } from './infrastructure/typeorm/repositories/typeorm-account.repository';

@Module({
  imports: [TypeOrmModule.forFeature([AccountModel])],
  providers: [TypeOrmAccountRepository],
  exports: [TypeOrmAccountRepository],
})
export class AccountModule {}
