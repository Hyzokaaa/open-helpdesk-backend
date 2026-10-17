/** What a step needs to know about the person to tell whether it is still pending. */
export interface OnboardingContext {
  userId: string;
  isEmailVerified: boolean;
  isSystemAdmin: boolean;
  /** Workspaces the person belongs to, with any role. */
  workspaceCount: number;
  /** Whether the person may create a workspace (system admin, or self-service on). */
  canCreateWorkspace: boolean;
}

/**
 * One step of the onboarding. It says whether it is still pending from the real state of the
 * account (verified, member of a workspace, has a plan…), so nothing has to remember that it
 * was done, and a person who got there another way (an invitation, an admin) skips it.
 */
export interface OnboardingStep {
  /** Stable key, also the client's step name ("verify", "workspace", "plan"). */
  key: string;
  /** Whether the person may leave it for later; a skipped step counts as done. */
  skippable: boolean;
  /** Placed right after this step; core steps keep their own order. */
  after?: string;
  isPending(context: OnboardingContext): Promise<boolean>;
}

/**
 * Steps an extension (cloud) adds to the core ones, provided under this token as
 * OnboardingStep[] and looked up with ModuleRef, like the other core extension points.
 */
export const ONBOARDING_STEPS = 'ONBOARDING_STEPS';
