import { ApiKeyScope } from '../../../../api-key/domain/enums/api-key-scope.enum';

/** What each scope allows, keyed by the scope so a new scope cannot be left out of the document. */
export const SCOPE_DESCRIPTIONS: Record<ApiKeyScope, string> = {
  [ApiKeyScope.TICKETS_READ]: 'List tickets and read a ticket.',
  [ApiKeyScope.TICKETS_WRITE]: 'Create, update (fields, status, assignee) and delete tickets.',
  [ApiKeyScope.COMMENTS_READ]: 'List the comments of a ticket.',
  [ApiKeyScope.COMMENTS_WRITE]: 'Add comments to a ticket.',
  [ApiKeyScope.MEMBERS_READ]: 'List the members of the workspace.',
  [ApiKeyScope.AUTH_EXCHANGE]: 'Create users and agents of the workspace and sign them in (delegated sign-in).',
  [ApiKeyScope.AUTH_EXCHANGE_ADMIN]: 'With `auth:exchange`: also create and sign in supervisors and admins of the workspace. Never granted by default.',
};

export interface DocumentedScope {
  scope: ApiKeyScope;
  description: string;
  /** Whether a key created without choosing scopes gets it. */
  default: boolean;
}
