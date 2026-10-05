export enum ApiKeyScope {
  TICKETS_READ = 'tickets:read',
  TICKETS_WRITE = 'tickets:write',
  COMMENTS_READ = 'comments:read',
  COMMENTS_WRITE = 'comments:write',
  MEMBERS_READ = 'members:read',
  AUTH_EXCHANGE = 'auth:exchange',
  /** With AUTH_EXCHANGE: also create and sign in supervisors and admins of the workspace. */
  AUTH_EXCHANGE_ADMIN = 'auth:exchange:admin',
}

export const ALL_API_KEY_SCOPES = Object.values(ApiKeyScope);

/** Granted when a key is created without scopes. Acting as an admin is never implied. */
export const DEFAULT_API_KEY_SCOPES = ALL_API_KEY_SCOPES.filter((s) => s !== ApiKeyScope.AUTH_EXCHANGE_ADMIN);
