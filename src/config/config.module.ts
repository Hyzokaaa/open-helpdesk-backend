import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { UserModule } from '../user/user.module';
import { NotificationModule } from '../notification/notification.module';
import { CoreConfigController } from './infrastructure/nest/controllers/core-config.controller';
import { SystemEmailSettingsController } from './infrastructure/nest/controllers/system-email-settings.controller';
import { SystemBrandingController } from './infrastructure/nest/controllers/system-branding.controller';
import { SystemNotificationSettingsController } from './infrastructure/nest/controllers/system-notification-settings.controller';
import { SystemVersionController } from './infrastructure/nest/controllers/system-version.controller';
import { SystemEmailSettingsModel } from './infrastructure/typeorm/models/system-email-settings.model';
import { SystemBrandingModel } from './infrastructure/typeorm/models/system-branding.model';
import { SystemNotificationSettingsModel } from './infrastructure/typeorm/models/system-notification-settings.model';
import { TypeOrmSystemEmailSettingsRepository } from './infrastructure/typeorm/repositories/typeorm-system-email-settings.repository';
import { TypeOrmSystemBrandingRepository } from './infrastructure/typeorm/repositories/typeorm-system-branding.repository';
import { TypeOrmSystemNotificationSettingsRepository } from './infrastructure/typeorm/repositories/typeorm-system-notification-settings.repository';

@Module({
  imports: [SharedModule, AuditLogModule, UserModule, NotificationModule, TypeOrmModule.forFeature([SystemEmailSettingsModel, SystemBrandingModel, SystemNotificationSettingsModel])],
  controllers: [CoreConfigController, SystemEmailSettingsController, SystemBrandingController, SystemNotificationSettingsController, SystemVersionController],
  providers: [TypeOrmSystemEmailSettingsRepository, TypeOrmSystemBrandingRepository, TypeOrmSystemNotificationSettingsRepository],
  exports: [TypeOrmSystemEmailSettingsRepository, TypeOrmSystemBrandingRepository, TypeOrmSystemNotificationSettingsRepository],
})
export class CoreConfigModule {}
