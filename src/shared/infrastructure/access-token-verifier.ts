import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthUser } from '../nest/strategies/jwt.strategy';
import { AccessTokenPayload, authUserFromAccessToken } from '../nest/strategies/access-token';

export interface VerifiedAccessToken {
  user: AuthUser;
  expiresAt: Date;
}

/**
 * Verifies an access token outside the HTTP guards, e.g. on a websocket handshake. Applies the
 * same rule as JwtStrategy: valid signature, not expired, not a single-purpose token.
 */
@Injectable()
export class AccessTokenVerifier {
  constructor(private readonly jwtService: JwtService) {}

  verify(token: unknown): VerifiedAccessToken | null {
    if (typeof token !== 'string' || !token) return null;
    let payload: AccessTokenPayload;
    try {
      payload = this.jwtService.verify<AccessTokenPayload>(token);
    } catch {
      return null;
    }
    const user = authUserFromAccessToken(payload);
    if (!user || !payload.exp) return null;
    return { user, expiresAt: new Date(payload.exp * 1000) };
  }
}
