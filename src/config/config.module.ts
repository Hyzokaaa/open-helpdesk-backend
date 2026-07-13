import { Module } from '@nestjs/common';
import { CoreConfigController } from './infrastructure/nest/controllers/core-config.controller';

@Module({
  controllers: [CoreConfigController],
})
export class CoreConfigModule {}
