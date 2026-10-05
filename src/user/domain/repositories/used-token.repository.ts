/**
 * Ids of single-use tokens (OAuth sign-in codes and states, password reset links) that were
 * already spent. A row only needs to outlive the token itself.
 */
export interface UsedTokenRepository {
  /**
   * Records the token id as spent, atomically: true for the first caller only, false when it was
   * already spent, so two requests racing with the same token cannot both succeed.
   */
  markUsed(tokenId: string, expiresAt: Date): Promise<boolean>;
  /** Deletes ids of tokens that expired before `before`. Returns how many. */
  deleteExpired(before: Date): Promise<number>;
}
