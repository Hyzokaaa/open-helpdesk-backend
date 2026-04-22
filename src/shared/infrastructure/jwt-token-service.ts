import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from '../domain/token-service';

@Injectable()
export class JwtTokenService implements TokenService {
  constructor(private readonly jwtService: JwtService) {}

  sign(payload: Record<string, unknown>, options?: { expiresIn?: string }): string {
    return this.jwtService.sign(payload, options);
  }

  verify<T = Record<string, unknown>>(token: string): T {
    return this.jwtService.verify(token) as T;
  }
}
