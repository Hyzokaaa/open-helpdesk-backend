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

    return { success: result.success };
  }
}
