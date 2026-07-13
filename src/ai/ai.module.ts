import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AI_SERVICE } from './ai.constants';
import { OpenAICompatibleAIService } from './infrastructure/openai-compatible-ai.service';
import { AIController } from './infrastructure/nest/controllers/ai.controller';
import { AiUsageModel } from './infrastructure/typeorm/models/ai-usage.model';
import { TypeOrmAiUsageRepository } from './infrastructure/typeorm/repositories/typeorm-ai-usage.repository';

const aiEnabled = !!process.env.AI_API_KEY;

@Module({
  imports: aiEnabled ? [TypeOrmModule.forFeature([AiUsageModel])] : [],
  controllers: aiEnabled ? [AIController] : [],
  providers: aiEnabled ? [
    {
      provide: AI_SERVICE,
      useClass: OpenAICompatibleAIService,
    },
    TypeOrmAiUsageRepository,
  ] : [],
  exports: aiEnabled ? [AI_SERVICE, TypeOrmAiUsageRepository] : [],
})
export class AIModule {}
