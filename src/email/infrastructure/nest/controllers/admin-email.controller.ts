import {
  Controller,
  Post,
  Body,
  Inject,
  ForbiddenException,
} from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { EmailService } from '../../../domain/email.service';
import { EMAIL_SERVICE } from '../../../email.constants';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';

class SendAdminEmailDto {
  @IsString()
  to!: string;

  @IsString()
  subject!: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsString()
  from?: string;
}

@Controller('admin/email')
export class AdminEmailController {
  constructor(
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
  ) {}

  @Post('send')
  async send(
    @Body() dto: SendAdminEmailDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (!user.isSystemAdmin) {
      throw new ForbiddenException();
    }

    const result = await this.emailService.send({
      to: dto.to,
      subject: dto.subject,
      html: dto.body,
      from: dto.from,
    });

    // The body is not kept: only enough to know an admin wrote to someone from the installation
    await new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository).execute({
      action: AuditAction.SYSTEM_ADMIN_EMAIL_SENT,
      entityType: 'email',
      entityId: dto.to,
      userId: user.userId,
      workspaceId: null,
      metadata: { to: dto.to, subject: dto.subject, from: dto.from ?? null, success: result.success },
      category: AuditCategory.SYSTEM,
      level: result.success ? AuditLevel.INFO : AuditLevel.ERROR,
      source: 'ui',
    });

    return { success: result.success };
  }
}
