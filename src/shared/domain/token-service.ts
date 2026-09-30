export interface TokenService {
  /** Every token states its own lifetime: there is no global default to inherit by accident. */
  sign(payload: Record<string, unknown>, options: { expiresIn: string }): string;
  verify<T = Record<string, unknown>>(token: string): T;
}
