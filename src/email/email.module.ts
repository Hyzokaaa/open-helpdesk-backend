import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmtpEmailService } from './infrastructure/smtp-email.service';
import { PostmarkEmailService } from './infrastructure/postmark-email.service';
import { TicketCreatedHandler } from './handlers/ticket-created.handler';
import { TicketAssignedHandler } from './handlers/ticket-assigned.handler';
import { NewCommentHandler } from './handlers/new-comment.handler';
import { StatusChangedHandler } from './handlers/status-changed.handler';
import { CsatSurveyHandler } from './handlers/csat-survey.handler';
import { UserModule } from '../user/user.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { NotificationModule } from '../notification/notification.module';
import { SharedModule } from '../shared/shared.module';
import { CsatModule } from '../csat/csat.module';
import { TicketModule } from '../ticket/ticket.module';
import { EMAIL_SERVICE } from './email.constants';
import { CSAT_SURVEY_GUARD } from '../csat/domain/csat-survey-guard';

@Global()
@Module({
  imports: [UserModule, WorkspaceModule, NotificationModule, SharedModule, CsatModule, TicketModule],
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
    CsatSurveyHandler,
    { provide: CSAT_SURVEY_GUARD, useValue: { canSendSurvey: async () => true } },
  ],
  exports: [EMAIL_SERVICE, CSAT_SURVEY_GUARD],
})
export class EmailModule {}
