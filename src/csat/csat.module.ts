import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CsatResponseModel } from './infrastructure/typeorm/models/csat-response.model';
import { TypeOrmCsatResponseRepository } from './infrastructure/typeorm/repositories/typeorm-csat-response.repository';
import { CsatController } from './infrastructure/nest/controllers/csat.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([CsatResponseModel])],
  controllers: [CsatController],
  providers: [TypeOrmCsatResponseRepository],
  exports: [TypeOrmCsatResponseRepository],
})
export class CsatModule {}
