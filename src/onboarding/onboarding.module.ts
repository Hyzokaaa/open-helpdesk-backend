import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { UserModule } from '../user/user.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { OnboardingStepSkipModel } from './infrastructure/typeorm/models/onboarding-step-skip.model';
import { TypeOrmOnboardingStepSkipRepository } from './infrastructure/typeorm/repositories/typeorm-onboarding-step-skip.repository';
import { OnboardingController } from './infrastructure/nest/controllers/onboarding.controller';

@Module({
  imports: [SharedModule, UserModule, forwardRef(() => WorkspaceModule), TypeOrmModule.forFeature([OnboardingStepSkipModel])],
  controllers: [OnboardingController],
  providers: [TypeOrmOnboardingStepSkipRepository],
  exports: [TypeOrmOnboardingStepSkipRepository],
})
export class OnboardingModule {}
