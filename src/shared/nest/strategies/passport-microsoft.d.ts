declare module 'passport-microsoft' {
  import { Strategy as PassportStrategy } from 'passport';

  interface StrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string[];
    tenant?: string;
  }

  interface Profile {
    id: string;
    displayName: string;
    emails?: Array<{ value: string; type?: string }>;
    _json?: {
      mail?: string;
      userPrincipalName?: string;
      givenName?: string;
      surname?: string;
    };
  }

  type VerifyCallback = (err: Error | null, user?: unknown, info?: unknown) => void;
  type VerifyFunction = (accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback) => void;

  export class Strategy extends PassportStrategy {
    constructor(options: StrategyOptions, verify: VerifyFunction);
  }
}
