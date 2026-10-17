import { Controller, Get, Inject, Logger, OnModuleInit, Param, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { SkipEmailVerification } from '../../../../shared/nest/decorators/skip-email-verification.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmWorkspaceCreationSettingsRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-creation-settings.repository';
import { workspaceCreationPolicy } from '../../../../workspace/infrastructure/nest/workspace-creation-policy';
import { ONBOARDING_STEPS, OnboardingStep } from '../../../domain/onboarding-step';
import { VerifyEmailStep } from '../../../domain/steps/verify-email.step';
import { CreateWorkspaceStep } from '../../../domain/steps/create-workspace.step';
import { ResolveOnboarding, orderOnboardingSteps } from '../../../domain/services/onboarding-resolve';
import { SkipOnboardingStep } from '../../../domain/services/onboarding-step-skip';
import { GetOnboardingQuery } from '../../../application/queries/get-onboarding.query';
import { SkipOnboardingStepCommand } from '../../../application/commands/skip-onboarding-step.command';
import { TypeOrmOnboardingStepSkipRepository } from '../../typeorm/repositories/typeorm-onboarding-step-skip.repository';

/**
 * Where the signed-in person is in the onboarding. Open to accounts whose email is not verified
 * yet: telling them to verify it is the first step.
 */
@Controller('onboarding')
export class OnboardingController implements OnModuleInit {
  private readonly logger = new Logger(OnboardingController.name);
  private steps: OnboardingStep[] = [new VerifyEmailStep(), new CreateWorkspaceStep()];

  constructor(
    private readonly moduleRef: ModuleRef,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly creationSettingsRepository: TypeOrmWorkspaceCreationSettingsRepository,
    @Inject() private readonly skipRepository: TypeOrmOnboardingStepSkipRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    let extra: OnboardingStep[] = [];
    try {
      extra = this.moduleRef.get<OnboardingStep[]>(ONBOARDING_STEPS, { strict: false });
    } catch {
      // No extension adds steps: the core ones are the onboarding
    }
    this.steps = orderOnboardingSteps(this.steps, extra);
    this.logger.log(`Onboarding steps: ${this.steps.map((s) => s.key).join(', ')}`);
  }

  @SkipEmailVerification()
  @Get()
  get(@CurrentUser() user: AuthUser) {
    return new GetOnboardingQuery(this.resolver()).execute({ userId: user.userId });
  }

  @Post('steps/:step/skip')
  skip(@CurrentUser() user: AuthUser, @Param('step') step: string) {
    const command = new SkipOnboardingStepCommand(new SkipOnboardingStep(this.steps, this.idGenerator, this.skipRepository), this.resolver());
    return command.execute({ userId: user.userId, step });
  }

  private resolver(): ResolveOnboarding {
    return new ResolveOnboarding(
      this.steps,
      this.userRepository,
      this.memberRepository,
      this.skipRepository,
      workspaceCreationPolicy(this.creationSettingsRepository, this.config),
    );
  }
}
