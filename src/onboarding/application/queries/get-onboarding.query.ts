import { Query } from '../../../shared/domain/query';
import { OnboardingState, ResolveOnboarding } from '../../domain/services/onboarding-resolve';

interface Props {
  userId: string;
}

export class GetOnboardingQuery implements Query<Props, OnboardingState> {
  constructor(private readonly resolveOnboarding: ResolveOnboarding) {}

  execute(props: Props): Promise<OnboardingState> {
    return this.resolveOnboarding.execute({ userId: props.userId });
  }
}
