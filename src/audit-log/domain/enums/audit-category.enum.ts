export enum AuditCategory {
  TICKET = 'ticket',
  WORKSPACE = 'workspace',
  USER = 'user',
  EMAIL = 'email',
  CONFIG = 'config',
  KNOWLEDGE_BASE = 'knowledge-base',
  SYSTEM = 'system',
  BILLING = 'billing',
  /** Sign-ins and their failures, password resets, refused requests, API sessions: kept apart for retention. */
  SECURITY = 'security',
}
