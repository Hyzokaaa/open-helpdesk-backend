import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { NotificationModel } from './infrastructure/typeorm/models/notification.model';
import { NotificationPreferenceModel } from './infrastructure/typeorm/models/notification-preference.model';
import { TypeOrmNotificationRepository } from './infrastructure/typeorm/repositories/typeorm-notification.repository';
import { TypeOrmNotificationPreferenceRepository } from './infrastructure/typeorm/repositories/typeorm-notification-preference.repository';
import { NotificationController } from './infrastructure/nest/controllers/notification.controller';

@Module({
  imports: [
    SharedModule,
    TypeOrmModule.forFeature([NotificationModel, NotificationPreferenceModel]),
  ],
  controllers: [NotificationController],
  providers: [
    TypeOrmNotificationRepository,
    TypeOrmNotificationPreferenceRepository,
  ],
  exports: [
    TypeOrmNotificationRepository,
    TypeOrmNotificationPreferenceRepository,
  ],
})
export class NotificationModule {}
