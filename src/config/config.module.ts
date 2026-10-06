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
import { SystemAnalyticsController } from './infrastructure/nest/controllers/system-analytics.controller';
import { SystemEmailSettingsModel } from './infrastructure/typeorm/models/system-email-settings.model';
import { SystemBrandingModel } from './infrastructure/typeorm/models/system-branding.model';
import { SystemNotificationSettingsModel } from './infrastructure/typeorm/models/system-notification-settings.model';
import { SystemAnalyticsSettingsModel } from './infrastructure/typeorm/models/system-analytics-settings.model';
import { TypeOrmSystemEmailSettingsRepository } from './infrastructure/typeorm/repositories/typeorm-system-email-settings.repository';
import { TypeOrmSystemBrandingRepository } from './infrastructure/typeorm/repositories/typeorm-system-branding.repository';
import { TypeOrmSystemNotificationSettingsRepository } from './infrastructure/typeorm/repositories/typeorm-system-notification-settings.repository';
import { TypeOrmSystemAnalyticsSettingsRepository } from './infrastructure/typeorm/repositories/typeorm-system-analytics-settings.repository';
import { VersionCheckScheduler } from './infrastructure/nest/services/version-check.scheduler';

@Module({
  imports: [SharedModule, AuditLogModule, UserModule, NotificationModule, TypeOrmModule.forFeature([SystemEmailSettingsModel, SystemBrandingModel, SystemNotificationSettingsModel, SystemAnalyticsSettingsModel])],
  controllers: [CoreConfigController, SystemEmailSettingsController, SystemBrandingController, SystemNotificationSettingsController, SystemVersionController, SystemAnalyticsController],
  providers: [TypeOrmSystemEmailSettingsRepository, TypeOrmSystemBrandingRepository, TypeOrmSystemNotificationSettingsRepository, TypeOrmSystemAnalyticsSettingsRepository, VersionCheckScheduler],
  exports: [TypeOrmSystemEmailSettingsRepository, TypeOrmSystemBrandingRepository, TypeOrmSystemNotificationSettingsRepository, TypeOrmSystemAnalyticsSettingsRepository],
})
export class CoreConfigModule {}
