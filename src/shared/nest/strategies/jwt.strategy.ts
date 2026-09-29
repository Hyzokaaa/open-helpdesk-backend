import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface JwtPayload {
  sub: string;
  email: string;
  isSystemAdmin: boolean;
  isEmailVerified: boolean;
  /** Set on single-purpose tokens (password reset, email verification, invitation…). */
  type?: string;
}

export interface AuthUser {
  userId: string;
  email: string;
  isSystemAdmin: boolean;
  isEmailVerified: boolean;
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
    return { userId: payload.sub, email: payload.email, isSystemAdmin: payload.isSystemAdmin, isEmailVerified: payload.isEmailVerified };
  }
}
