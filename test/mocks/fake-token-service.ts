import { TokenService } from '../../src/shared/domain/token-service';

/** Tokens are the JSON payload itself, so a test can read back what was signed. */
export class FakeTokenService implements TokenService {
  sign(payload: Record<string, unknown>, _options: { expiresIn: string }): string {
    return JSON.stringify(payload);
  }

  verify<T = Record<string, unknown>>(token: string): T {
    return JSON.parse(token) as T;
  }
}
