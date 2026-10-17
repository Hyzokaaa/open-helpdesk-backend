import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Whether the session behind an access token still counts: not revoked, not expired, and its user
 * still active. Checked on every request and socket, so signing out, a password reset or a
 * deactivation take effect at once instead of when the access token expires. One lookup by
 * primary key; no cache, so every instance of the API agrees at once.
 */
@Injectable()
export class SessionLiveness {
  constructor(private readonly dataSource: DataSource) {}

  async isLive(sessionId: string, now: Date = new Date()): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT 1 FROM user_sessions s JOIN users u ON u.id = s."userId"
       WHERE s.id = $1 AND s."revokedAt" IS NULL AND s."expiresAt" > $2 AND u."isActive" = true`,
      [sessionId, now],
    );
    return rows.length > 0;
  }
}
