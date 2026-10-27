/** How an account came to exist. Null on accounts created before it was recorded and not deducible. */
export enum UserSignupMethod {
  /** Registered on their own (the cloud's public sign-up) */
  SIGNUP = 'signup',
  /** Accepted an invitation to a workspace */
  INVITATION = 'invitation',
  /** First signed in with Google */
  GOOGLE = 'google',
  /** Created by a system admin */
  ADMIN = 'admin',
  /** Imported with a workspace's members */
  IMPORT = 'import',
  /** Signed in by an integration through an API key */
  INTEGRATION = 'integration',
  /** Created on the fly as the reporter of a ticket: by email, the portal or on someone's behalf */
  REPORTER = 'reporter',
}
