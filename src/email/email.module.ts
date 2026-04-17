import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmtpEmailService } from './infrastructure/smtp-email.service';
import { PostmarkEmailService } from './infrastructure/postmark-email.service';
import { TicketCreatedHandler } from './handlers/ticket-created.handler';
import { TicketAssignedHandler } from './handlers/ticket-assigned.handler';
import { NewCommentHandler } from './handlers/new-comment.handler';
import { StatusChangedHandler } from './handlers/status-changed.handler';
import { UserModule } from '../user/user.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { EMAIL_SERVICE } from './email.constants';

@Global()
@Module({
  imports: [UserModule, WorkspaceModule],
  providers: [
    {
      provide: EMAIL_SERVICE,
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('EMAIL_PROVIDER', 'smtp');
        if (provider === 'postmark') {
          return new PostmarkEmailService(config);
        }
        return new SmtpEmailService(config);
      },
      inject: [ConfigService],
    },
    TicketCreatedHandler,
    TicketAssignedHandler,
    NewCommentHandler,
    StatusChangedHandler,
  ],
  exports: [EMAIL_SERVICE],
})
export class EmailModule {}
