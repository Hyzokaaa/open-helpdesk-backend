import { Body, Controller, Inject, Post } from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { AIService } from '../../../domain/ai.service';
import { ImproveText } from '../../../domain/services/improve-text';
import { TranslateText } from '../../../domain/services/translate-text';
import { AI_SERVICE } from '../../../ai.constants';
import { TypeOrmAiUsageRepository } from '../../typeorm/repositories/typeorm-ai-usage.repository';

class ImproveRequest {
  @IsString()
  text!: string;

  @IsString()
  workspaceSlug!: string;

  @IsOptional()
  @IsString()
  language?: string;
}

class TranslateRequest {
  @IsString()
  text!: string;

  @IsString()
  workspaceSlug!: string;

  @IsString()
  targetLanguage!: string;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

@Controller('ai')
export class AIController {
  constructor(
    @Inject(AI_SERVICE) private readonly aiService: AIService,
    @Inject() private readonly aiUsageRepository: TypeOrmAiUsageRepository,
  ) {}

  @Post('improve')
  async improve(
    @Body() body: ImproveRequest,
    @CurrentUser() _user: AuthUser,
  ) {
    const service = new ImproveText(this.aiService);
    const result = await service.execute({
      text: body.text,
      language: body.language,
    });
    this.aiUsageRepository.increment(body.workspaceSlug, currentMonth()).catch(() => {});
    return { result };
  }

  @Post('translate')
  async translate(
    @Body() body: TranslateRequest,
    @CurrentUser() _user: AuthUser,
  ) {
    const service = new TranslateText(this.aiService);
    const result = await service.execute({
      text: body.text,
      targetLanguage: body.targetLanguage,
    });
    this.aiUsageRepository.increment(body.workspaceSlug, currentMonth()).catch(() => {});
    return { result };
  }
}
