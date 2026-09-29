import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface JwtPayload {
  sub: string;
  email: string;
  isSystemAdmin: boolean;
  isEmailVerified: boolean;
  /** Session the token was issued for; absent on tokens from the API token exchange. */
  sid?: string;
  /** Set on single-purpose tokens (password reset, email verification, OAuth code…). */
  type?: string;
}

export interface AuthUser {
  userId: string;
  email: string;
  isSystemAdmin: boolean;
  isEmailVerified: boolean;
  sessionId?: string;
  apiKeyId?: string;
  workspaceId?: string;
  apiKeyScopes?: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload): AuthUser {
    // Single-purpose tokens share the signing secret; they must not work as access tokens
    if (payload.type) throw new UnauthorizedException();
    return {
      userId: payload.sub,
      email: payload.email,
      isSystemAdmin: payload.isSystemAdmin,
      isEmailVerified: payload.isEmailVerified,
      sessionId: payload.sid,
    };
  }
}
