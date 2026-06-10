export enum ApiKeyScope {
  TICKETS_READ = 'tickets:read',
  TICKETS_WRITE = 'tickets:write',
  COMMENTS_READ = 'comments:read',
  COMMENTS_WRITE = 'comments:write',
  MEMBERS_READ = 'members:read',
}

export const ALL_API_KEY_SCOPES = Object.values(ApiKeyScope);
