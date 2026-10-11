/** Length of the window in which a file keeps the same signed link. */
export const PRESIGNED_LINK_WINDOW_SECONDS = 3600;

export interface PresignedLinkWindow {
  /** When the link counts as signed: the start of the current window. */
  signedAt: Date;
  /** Lifetime counted from `signedAt`. */
  expiresIn: number;
  /** Unix time, in seconds, when the link stops working. */
  expiresAt: number;
}

/**
 * Signing a link with the current time gives a new URL every second, so the browser never
 * reuses a logo or an avatar it already downloaded. Signing at the start of the current
 * window keeps the URL identical for the whole window, and the lifetime grows by one window
 * so the link still lasts at least `expiresIn` from now.
 */
export function presignedLinkWindow(expiresIn: number, now: number = Date.now()): PresignedLinkWindow {
  const windowMs = PRESIGNED_LINK_WINDOW_SECONDS * 1000;
  const signedAtMs = Math.floor(now / windowMs) * windowMs;
  const lifetime = expiresIn + PRESIGNED_LINK_WINDOW_SECONDS;
  return {
    signedAt: new Date(signedAtMs),
    expiresIn: lifetime,
    expiresAt: signedAtMs / 1000 + lifetime,
  };
}
