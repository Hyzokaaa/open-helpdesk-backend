import { Workspace } from '../entities/workspace';

/** Daily checks in a row a verified domain may fail before sessions stop being handed over to it. */
export const CUSTOM_DOMAIN_FAILURES_BEFORE_DISTRUST = 3;

/**
 * Whether the installation may hand a signed-in session over to the workspace's domain. A domain
 * that stopped pointing here may belong to someone else by now, so after several failed checks
 * it no longer receives sessions; everything else on it keeps working.
 */
export function isCustomDomainTrusted(workspace: Workspace): boolean {
  return workspace.customDomainVerified && workspace.customDomainCheckFailures < CUSTOM_DOMAIN_FAILURES_BEFORE_DISTRUST;
}
