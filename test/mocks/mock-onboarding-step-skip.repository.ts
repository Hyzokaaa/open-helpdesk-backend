import { OnboardingStepSkip } from '../../src/onboarding/domain/entities/onboarding-step-skip';
import { OnboardingStepSkipRepository } from '../../src/onboarding/domain/repositories/onboarding-step-skip.repository';

export class MockOnboardingStepSkipRepository implements OnboardingStepSkipRepository {
  readonly skips: OnboardingStepSkip[] = [];

  async create(skip: OnboardingStepSkip): Promise<void> {
    if (this.skips.some((s) => s.userId === skip.userId && s.step === skip.step)) return;
    this.skips.push(skip);
  }

  async findStepsByUserId(userId: string): Promise<string[]> {
    return this.skips.filter((s) => s.userId === userId).map((s) => s.step);
  }
}
