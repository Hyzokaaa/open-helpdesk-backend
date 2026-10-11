import { presignedLinkWindow, PRESIGNED_LINK_WINDOW_SECONDS } from '../../../src/shared/domain/presigned-link-window';

const HOUR = PRESIGNED_LINK_WINDOW_SECONDS * 1000;
const START = Date.UTC(2026, 9, 10, 15, 0, 0);

describe('presignedLinkWindow', () => {
  it('gives the same link data for the whole window', () => {
    const a = presignedLinkWindow(3600, START + 1_000);
    const b = presignedLinkWindow(3600, START + HOUR - 1_000);
    expect(a).toEqual(b);
    expect(a.signedAt.getTime()).toBe(START);
  });

  it('moves to new link data in the next window', () => {
    const a = presignedLinkWindow(3600, START + HOUR - 1);
    const b = presignedLinkWindow(3600, START + HOUR);
    expect(b.signedAt.getTime()).toBe(START + HOUR);
    expect(b.expiresAt).toBe(a.expiresAt + PRESIGNED_LINK_WINDOW_SECONDS);
  });

  it('keeps the link valid for at least the requested time from now', () => {
    for (const offset of [0, 1, HOUR / 2, HOUR - 1]) {
      const now = START + offset;
      const { expiresAt } = presignedLinkWindow(3600, now);
      expect(expiresAt * 1000 - now).toBeGreaterThanOrEqual(3600 * 1000);
    }
  });

  it('counts the lifetime from the start of the window', () => {
    const w = presignedLinkWindow(600, START + 10_000);
    expect(w.expiresIn).toBe(600 + PRESIGNED_LINK_WINDOW_SECONDS);
    expect(w.expiresAt).toBe(START / 1000 + w.expiresIn);
  });
});
