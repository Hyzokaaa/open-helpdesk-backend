import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AccessTokenPayload, authUserFromAccessToken } from './access-token';

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

  validate(payload: AccessTokenPayload): AuthUser {
    const user = authUserFromAccessToken(payload);
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
