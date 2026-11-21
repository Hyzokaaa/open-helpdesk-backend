/** How many notices a room gets per minute before the rest are only counted. */
export const MATRIX_NOTICES_PER_MINUTE = 20;
const WINDOW_MS = 60_000;

interface Window {
  startedAt: number;
  sent: number;
  skipped: number;
}

/**
 * Caps the notices per room and minute, so a burst (a mailbox read for the first time, a bulk
 * change) does not flood the room. What goes over is counted; drain() answers the counts of the
 * windows that ended, for one summary notice each.
 */
export class MatrixNoticeThrottle {
  private readonly windows = new Map<string, Window>();
  /** Skipped counts of windows that ended before drain() saw them. */
  private readonly ended = new Map<string, number>();

  constructor(
    private readonly limit = MATRIX_NOTICES_PER_MINUTE,
    private readonly now: () => number = Date.now,
  ) {}

  /** Whether the room may get one more notice now. */
  take(roomKey: string): boolean {
    const now = this.now();
    let window = this.windows.get(roomKey);
    if (!window || now - window.startedAt >= WINDOW_MS) {
      if (window) this.close(roomKey, window);
      window = { startedAt: now, sent: 0, skipped: 0 };
      this.windows.set(roomKey, window);
    }
    if (window.sent < this.limit) {
      window.sent++;
      return true;
    }
    window.skipped++;
    return false;
  }

  /** The rooms that had notices left out in a window that ended, and how many; forgets them. */
  drain(): Array<{ roomKey: string; skipped: number }> {
    const now = this.now();
    for (const [roomKey, window] of this.windows) {
      if (now - window.startedAt >= WINDOW_MS) {
        this.close(roomKey, window);
        this.windows.delete(roomKey);
      }
    }
    const out = [...this.ended].map(([roomKey, skipped]) => ({ roomKey, skipped }));
    this.ended.clear();
    return out;
  }

  private close(roomKey: string, window: Window): void {
    if (window.skipped > 0) this.ended.set(roomKey, (this.ended.get(roomKey) ?? 0) + window.skipped);
  }
}
