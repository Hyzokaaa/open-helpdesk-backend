import { UsedTokenRepository } from '../repositories/used-token.repository';

/** Forgets spent single-use tokens once they have expired anyway. Idempotent. */
export class PurgeUsedTokens {
  constructor(private readonly usedTokens: UsedTokenRepository) {}

  async execute(props: { now?: Date } = {}): Promise<number> {
    return this.usedTokens.deleteExpired(props.now ?? new Date());
  }
}
