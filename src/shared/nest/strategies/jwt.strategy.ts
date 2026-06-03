import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface JwtPayload {
  sub: string;
  email: string;
  isSystemAdmin: boolean;
  isEmailVerified: boolean;
}

export interface AuthUser {
  userId: string;
  email: string;
  isSystemAdmin: boolean;
  isEmailVerified: boolean;
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
    return { userId: payload.sub, email: payload.email, isSystemAdmin: payload.isSystemAdmin, isEmailVerified: payload.isEmailVerified };
  }
}
