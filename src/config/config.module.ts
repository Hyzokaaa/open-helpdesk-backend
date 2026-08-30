import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { CoreConfigController } from './infrastructure/nest/controllers/core-config.controller';
import { SystemEmailSettingsController } from './infrastructure/nest/controllers/system-email-settings.controller';
import { SystemBrandingController } from './infrastructure/nest/controllers/system-branding.controller';
import { SystemVersionController } from './infrastructure/nest/controllers/system-version.controller';
import { SystemEmailSettingsModel } from './infrastructure/typeorm/models/system-email-settings.model';
import { SystemBrandingModel } from './infrastructure/typeorm/models/system-branding.model';
import { TypeOrmSystemEmailSettingsRepository } from './infrastructure/typeorm/repositories/typeorm-system-email-settings.repository';
import { TypeOrmSystemBrandingRepository } from './infrastructure/typeorm/repositories/typeorm-system-branding.repository';

@Module({
  imports: [SharedModule, AuditLogModule, TypeOrmModule.forFeature([SystemEmailSettingsModel, SystemBrandingModel])],
  controllers: [CoreConfigController, SystemEmailSettingsController, SystemBrandingController, SystemVersionController],
  providers: [TypeOrmSystemEmailSettingsRepository, TypeOrmSystemBrandingRepository],
  exports: [TypeOrmSystemEmailSettingsRepository, TypeOrmSystemBrandingRepository],
})
export class CoreConfigModule {}
