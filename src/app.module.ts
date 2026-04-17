import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { SharedModule } from './shared/shared.module';
import { UserModule } from './user/user.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { TagModule } from './tag/tag.module';
import { TicketModule } from './ticket/ticket.module';
import { CommentModule } from './comment/comment.module';
import { AttachmentModule } from './attachment/attachment.module';
import { EmailModule } from './email/email.module';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get('DB_PORT', 5432),
        username: config.get('DB_USER', 'postgres'),
        password: config.get('DB_PASSWORD', 'postgres'),
        database: config.get('DB_NAME', 'dealernode_helpdesk'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    SharedModule,
    UserModule,
    WorkspaceModule,
    TagModule,
    TicketModule,
    CommentModule,
    AttachmentModule,
    EmailModule,
  ],
})
export class AppModule {}
