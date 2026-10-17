import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AccessTokenPayload, authUserFromAccessToken } from './access-token';
import { SessionLiveness } from '../../infrastructure/session-liveness';

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
  constructor(
    config: ConfigService,
    private readonly liveness: SessionLiveness,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow('JWT_SECRET'),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthUser> {
    const user = authUserFromAccessToken(payload);
    if (!user) throw new UnauthorizedException();
    // Tokens from the API token exchange carry no session and keep their own lifetime
    if (user.sessionId && !(await this.liveness.isLive(user.sessionId))) throw new UnauthorizedException();
    return user;
  }
}
