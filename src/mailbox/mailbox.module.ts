import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { MailboxModel } from './infrastructure/typeorm/models/mailbox.model';
import { TypeOrmMailboxRepository } from './infrastructure/typeorm/repositories/typeorm-mailbox.repository';

@Module({
  imports: [SharedModule, TypeOrmModule.forFeature([MailboxModel])],
  providers: [TypeOrmMailboxRepository],
  exports: [TypeOrmMailboxRepository],
})
export class MailboxModule {}
