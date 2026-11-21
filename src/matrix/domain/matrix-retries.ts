import { MatrixApiError } from './matrix-client';

const MAX_ATTEMPTS = 3;
/** Longest wait a rate limit is honoured for; beyond it the call is given up. */
const MAX_WAIT_MS = 60_000;
const BACKOFF_MS = [1_000, 4_000];

export type Sleep = (ms: number) => Promise<void>;

export const realSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs a homeserver call again when the server asks to wait (429), fails or does not answer.
 * rateLimitOnly: only after a 429, for a call the server may have carried out when it failed.
 */
export async function withMatrixRetries<T>(call: () => Promise<T>, sleep: Sleep = realSleep, rateLimitOnly = false): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await call();
    } catch (error) {
      if (!(error instanceof MatrixApiError) || !error.retryable || attempt >= MAX_ATTEMPTS) throw error;
      if (rateLimitOnly && error.status !== 429) throw error;
      const wait = error.status === 429 ? (error.retryAfterMs ?? BACKOFF_MS[0]) : BACKOFF_MS[attempt - 1];
      if (wait > MAX_WAIT_MS) throw error;
      await sleep(wait);
    }
  }
}
