import { MatrixIdentity } from '../entities/matrix-identity';

export interface MatrixIdentityRepository {
  findByUserId(userId: string): Promise<MatrixIdentity | null>;
  findByUserIds(userIds: string[]): Promise<MatrixIdentity[]>;
  /** Throws ConflictError when another identity was created for the same user meanwhile. */
  save(identity: MatrixIdentity): Promise<void>;
  /**
   * Counts one more try at the pending code, in one step so tries made at the same time all count.
   * Answers the tries counted so far, or null when `max` had already been reached (not counted).
   */
  claimCodeAttempt(id: string, max: number): Promise<number | null>;
}
