import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { WebhookModel } from './infrastructure/typeorm/models/webhook.model';
import { TypeOrmWebhookRepository } from './infrastructure/typeorm/repositories/typeorm-webhook.repository';
import { WebhookController } from './infrastructure/nest/controllers/webhook.controller';
import { WebhookDeliveryService } from './infrastructure/nest/services/webhook-delivery.service';

@Module({
  imports: [
    SharedModule,
    WorkspaceModule,
    AuditLogModule,
    TypeOrmModule.forFeature([WebhookModel]),
  ],
  controllers: [WebhookController],
  providers: [TypeOrmWebhookRepository, WebhookDeliveryService],
  exports: [TypeOrmWebhookRepository],
})
export class WebhookModule {}
