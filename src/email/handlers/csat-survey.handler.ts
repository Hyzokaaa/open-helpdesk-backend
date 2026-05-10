import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { EmailService } from '../domain/email.service';
import { EMAIL_SERVICE } from '../email.constants';
import { CsatSurveyTemplate } from '../templates/csat-survey.template';
import { StatusChangedEvent } from '../domain/events';
import { TypeOrmUserRepository } from '../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmTicketRepository } from '../../ticket/infrastructure/typeorm/repositories/typeorm-ticket.repository';
import { TypeOrmCsatResponseRepository } from '../../csat/infrastructure/typeorm/repositories/typeorm-csat-response.repository';
import { UlidGenerator } from '../../shared/infrastructure/ulid-generator';
import { CsatResponse } from '../../csat/domain/entities/csat-response';
import { CSAT_SURVEY_GUARD, CsatSurveyGuard } from '../../csat/domain/csat-survey-guard';

@Injectable()
export class CsatSurveyHandler {
  private readonly logger = new Logger(CsatSurveyHandler.name);
  private readonly apiUrl: string;

  constructor(
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
    @Inject(CSAT_SURVEY_GUARD) private readonly surveyGuard: CsatSurveyGuard,
    private readonly userRepository: TypeOrmUserRepository,
    private readonly ticketRepository: TypeOrmTicketRepository,
    private readonly csatRepository: TypeOrmCsatResponseRepository,
    private readonly idGenerator: UlidGenerator,
    private readonly config: ConfigService,
  ) {
    this.apiUrl = config.get('API_URL', 'http://localhost:3000');
  }

  @OnEvent('ticket.statusChanged')
  async handle(event: StatusChangedEvent): Promise<void> {
    if (event.newStatus !== 'resolved') return;

    const allowed = await this.surveyGuard.canSendSurvey(event.workspaceSlug);
    if (!allowed) return;

    const ticket = await this.ticketRepository.findById(event.ticketId);
    if (!ticket) return;

    const existing = await this.csatRepository.findByTicketId(event.ticketId);
    if (existing) return;

    if (ticket.creatorId === event.changedById) return;

    const creator = await this.userRepository.findById(ticket.creatorId);
    if (!creator) return;

    const token = randomUUID();
    const csatResponse = new CsatResponse({
      id: this.idGenerator.create(),
      ticketId: event.ticketId,
      workspaceId: event.workspaceId,
      token,
      rating: null,
      respondedAt: null,
    });
    await this.csatRepository.create(csatResponse);

    const lang = creator.language || 'en';
    const surveyBaseUrl = `${this.apiUrl}/csat/${token}`;
    const template = new CsatSurveyTemplate();

    try {
      await this.emailService.send({
        to: creator.email,
        subject: template.subject({ ticketName: event.ticketName, workspaceName: event.workspaceName, surveyBaseUrl, lang }),
        html: template.html({ ticketName: event.ticketName, workspaceName: event.workspaceName, surveyBaseUrl, lang }),
      });
    } catch (err) {
      this.logger.error(`Failed to send CSAT survey for ticket ${event.ticketId}: ${err}`);
    }
  }
}
