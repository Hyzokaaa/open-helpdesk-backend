import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { CsatResponseModel } from './infrastructure/typeorm/models/csat-response.model';
import { TypeOrmCsatResponseRepository } from './infrastructure/typeorm/repositories/typeorm-csat-response.repository';
import { CsatController } from './infrastructure/nest/controllers/csat.controller';

@Global()
@Module({
  imports: [SharedModule, AuditLogModule, TypeOrmModule.forFeature([CsatResponseModel])],
  controllers: [CsatController],
  providers: [TypeOrmCsatResponseRepository],
  exports: [TypeOrmCsatResponseRepository],
})
export class CsatModule {}
