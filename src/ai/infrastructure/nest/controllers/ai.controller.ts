import { Body, Controller, Inject, Post } from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { AIService } from '../../../domain/ai.service';
import { ImproveText } from '../../../domain/services/improve-text';
import { TranslateText } from '../../../domain/services/translate-text';
import { ImproveTextCommand } from '../../../application/commands/improve-text.command';
import { TranslateTextCommand } from '../../../application/commands/translate-text.command';
import { AI_SERVICE } from '../../../ai.constants';
import { TypeOrmAiUsageRepository } from '../../typeorm/repositories/typeorm-ai-usage.repository';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { EnsureWorkspacePermission } from '../../../../workspace/domain/services/workspace-ensure-permission';
import { ImproveTextRequest } from '../dto/improve-text.request';
import { TranslateTextRequest } from '../dto/translate-text.request';

@Controller('ai')
export class AIController {
  constructor(
    @Inject(AI_SERVICE) private readonly aiService: AIService,
    @Inject() private readonly aiUsageRepository: TypeOrmAiUsageRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
  ) {}

  @Post('improve')
  improve(@Body() body: ImproveTextRequest, @CurrentUser() user: AuthUser) {
    const command = new ImproveTextCommand(
      new ImproveText(this.aiService),
      new EnsureWorkspacePermission(this.memberRepository),
      this.workspaceRepository,
      this.aiUsageRepository,
    );
    return command.execute({
      workspaceSlug: body.workspaceSlug,
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
      text: body.text,
      language: body.language,
    });
  }

  @Post('translate')
  translate(@Body() body: TranslateTextRequest, @CurrentUser() user: AuthUser) {
    const command = new TranslateTextCommand(
      new TranslateText(this.aiService),
      new EnsureWorkspacePermission(this.memberRepository),
      this.workspaceRepository,
      this.aiUsageRepository,
    );
    return command.execute({
      workspaceSlug: body.workspaceSlug,
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
      text: body.text,
      targetLanguage: body.targetLanguage,
    });
  }
}
