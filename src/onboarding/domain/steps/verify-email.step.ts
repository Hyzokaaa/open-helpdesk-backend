import { OnboardingContext, OnboardingStep } from '../onboarding-step';

/** The email is confirmed before anything else; it cannot be skipped. */
export class VerifyEmailStep implements OnboardingStep {
  readonly key = 'verify';
  readonly skippable = false;

  async isPending(context: OnboardingContext): Promise<boolean> {
    return !context.isEmailVerified;
  }
}
