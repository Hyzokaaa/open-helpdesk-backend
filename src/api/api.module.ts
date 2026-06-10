import { Module } from '@nestjs/common';
import { SharedModule } from '../shared/shared.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { TicketModule } from '../ticket/ticket.module';
import { CommentModule } from '../comment/comment.module';
import { UserModule } from '../user/user.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { CustomFieldModule } from '../custom-field/custom-field.module';
import { ApiController } from './infrastructure/nest/controllers/api.controller';

@Module({
  imports: [
    SharedModule,
    WorkspaceModule,
    TicketModule,
    CommentModule,
    UserModule,
    AuditLogModule,
    CustomFieldModule,
  ],
  controllers: [ApiController],
})
export class ApiModule {}
