import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { JwtAuthGuard } from "./shared/nest/guards/jwt-auth.guard";
import { ApiKeyAuthGuard } from "./shared/nest/guards/api-key-auth.guard";
import { EmailVerifiedGuard } from "./shared/nest/guards/email-verified.guard";
import { SharedModule } from "./shared/shared.module";
import { UserModule } from "./user/user.module";
import { WorkspaceModule } from "./workspace/workspace.module";
import { TagModule } from "./tag/tag.module";
import { DepartmentModule } from "./department/department.module";
import { TicketModule } from "./ticket/ticket.module";
import { CommentModule } from "./comment/comment.module";
import { AttachmentModule } from "./attachment/attachment.module";
import { NotificationModule } from "./notification/notification.module";
import { EmailModule } from "./email/email.module";
import { AccountModule } from "./account/account.module";
import { AuditLogModule } from "./audit-log/audit-log.module";
import { CannedResponseModule } from "./canned-response/canned-response.module";
import { CustomFieldModule } from "./custom-field/custom-field.module";
import { ReportModule } from "./report/report.module";
import { CsatModule } from "./csat/csat.module";
import { MailboxModule } from "./mailbox/mailbox.module";
import { EmailInboundModule } from "./email-inbound/email-inbound.module";
import { ApiKeyModule } from "./api-key/api-key.module";
import { WebhookModule } from "./webhook/webhook.module";
import { ApiModule } from "./api/api.module";
import { AIModule } from "./ai/ai.module";
import { KnowledgeBaseModule } from "./knowledge-base/knowledge-base.module";
import { CoreConfigModule } from "./config/config.module";
import { HealthController } from "./health.controller";
import { ChangelogController } from "./changelog/changelog.controller";
import { AuditLogController } from "./audit-log/infrastructure/nest/controllers/audit-log.controller";
import { AdminAuditLogController } from "./audit-log/infrastructure/nest/controllers/admin-audit-log.controller";
import { WidgetController } from "./shared/infrastructure/nest/controllers/widget.controller";
import { SystemMailboxController } from "./mailbox/infrastructure/nest/controllers/system-mailbox.controller";
@Module({
  controllers: [HealthController, ChangelogController, AuditLogController, AdminAuditLogController, WidgetController, SystemMailboxController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ApiKeyAuthGuard },
    { provide: APP_GUARD, useClass: EmailVerifiedGuard },
  ],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 100 }] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "postgres",
        host: config.get("DB_HOST", "localhost"),
        port: config.get("DB_PORT", 5432),
        username: config.get("DB_USER", "postgres"),
        password: config.get("DB_PASSWORD", "postgres"),
        database: config.get("DB_NAME", "open_helpdesk"),
        autoLoadEntities: true,
        synchronize: config.get("DB_SYNCHRONIZE", "false") === "true",
        migrationsRun: config.get("DB_RUN_MIGRATIONS", "true") === "true",
        migrations: [__dirname + "/database/migrations/*{.ts,.js}"],
      }),
    }),
    SharedModule,
    UserModule,
    WorkspaceModule,
    TagModule,
    DepartmentModule,
    TicketModule,
    CommentModule,
    AttachmentModule,
    NotificationModule,
    EmailModule,
    AccountModule,
    AuditLogModule,
    CannedResponseModule,
    CustomFieldModule,
    ReportModule,
    CsatModule,
    MailboxModule,
    EmailInboundModule,
    ApiKeyModule,
    WebhookModule,
    ApiModule,
    AIModule,
    KnowledgeBaseModule,
    CoreConfigModule,
  ],
})
export class AppModule {}
