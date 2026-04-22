export interface TokenService {
  sign(payload: Record<string, unknown>, options?: { expiresIn?: string }): string;
  verify<T = Record<string, unknown>>(token: string): T;
}
