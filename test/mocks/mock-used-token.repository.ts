import { UsedTokenRepository } from '../../src/user/domain/repositories/used-token.repository';

export class MockUsedTokenRepository implements UsedTokenRepository {
  used = new Map<string, Date>();

  async markUsed(tokenId: string, expiresAt: Date): Promise<boolean> {
    if (this.used.has(tokenId)) return false;
    this.used.set(tokenId, expiresAt);
    return true;
  }

  async deleteExpired(before: Date): Promise<number> {
    let deleted = 0;
    for (const [id, expiresAt] of this.used) {
      if (expiresAt.getTime() < before.getTime()) {
        this.used.delete(id);
        deleted++;
      }
    }
    return deleted;
  }
}
