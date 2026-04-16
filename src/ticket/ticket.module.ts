import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { TicketModel } from './infrastructure/typeorm/models/ticket.model';
import { TypeOrmTicketRepository } from './infrastructure/typeorm/repositories/typeorm-ticket.repository';
import { TicketController } from './infrastructure/nest/controllers/ticket.controller';

@Module({
  imports: [SharedModule, WorkspaceModule, TypeOrmModule.forFeature([TicketModel])],
  controllers: [TicketController],
  providers: [TypeOrmTicketRepository],
  exports: [TypeOrmTicketRepository],
})
export class TicketModule {}
