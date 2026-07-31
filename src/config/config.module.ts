import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { CoreConfigController } from './infrastructure/nest/controllers/core-config.controller';
import { SystemEmailSettingsController } from './infrastructure/nest/controllers/system-email-settings.controller';
import { SystemEmailSettingsModel } from './infrastructure/typeorm/models/system-email-settings.model';
import { TypeOrmSystemEmailSettingsRepository } from './infrastructure/typeorm/repositories/typeorm-system-email-settings.repository';

@Module({
  imports: [SharedModule, TypeOrmModule.forFeature([SystemEmailSettingsModel])],
  controllers: [CoreConfigController, SystemEmailSettingsController],
  providers: [TypeOrmSystemEmailSettingsRepository],
  exports: [TypeOrmSystemEmailSettingsRepository],
})
export class CoreConfigModule {}
