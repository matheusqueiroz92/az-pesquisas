import { createHash } from 'node:crypto';

export interface SessionTokens {
  readonly accessToken: string;
  readonly accessTokenExpiresAt: string;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: string;
}

export type RefreshOutcome = { ok: true; tokens: SessionTokens } | { ok: false };

/**
 * One refresh at a time per refresh token (spec 007, rule 4).
 *
 * The API rotates the refresh token on every use and treats a second use of
 * the old one as theft, revoking the whole session (spec 005). Several tabs,
 * or several calls of one screen, can hit an expired access token at the same
 * moment; without this, the second refresh would log the person out.
 *
 * - Concurrent callers with the same token share ONE call to the API.
 * - A caller arriving shortly after (still holding the old cookie) receives the
 *   result already obtained, for `graceMs`.
 * - Network errors are not cached: the next caller tries again.
 *
 * Keys are SHA-256 hashes; raw refresh tokens are never kept as map keys.
 * Works because the panel runs as one process (design 007; Redis if that changes).
 */
export const createRefreshCoordinator = (options: {
  refresh: (refreshToken: string) => Promise<RefreshOutcome>;
  graceMs?: number;
  now?: () => number;
}) => {
  const graceMs = options.graceMs ?? 30_000;
  const now = options.now ?? Date.now;
  const inFlight = new Map<string, Promise<RefreshOutcome>>();
  const settled = new Map<string, { outcome: RefreshOutcome; expiresAt: number }>();

  const sweep = () => {
    const current = now();
    for (const [key, entry] of settled) {
      if (entry.expiresAt <= current) {
        settled.delete(key);
      }
    }
  };

  return {
    refresh: (refreshToken: string): Promise<RefreshOutcome> => {
      sweep();
      const key = createHash('sha256').update(refreshToken).digest('hex');

      const cached = settled.get(key);
      if (cached) {
        return Promise.resolve(cached.outcome);
      }
      const running = inFlight.get(key);
      if (running) {
        return running;
      }

      const call = options
        .refresh(refreshToken)
        .then((outcome) => {
          settled.set(key, { outcome, expiresAt: now() + graceMs });
          return outcome;
        })
        .finally(() => {
          inFlight.delete(key);
        });
      inFlight.set(key, call);
      return call;
    },
    /** For tests: how many results are cached. */
    size: () => settled.size,
    /** For tests: the stored keys (hashes). */
    keys: () => [...settled.keys(), ...inFlight.keys()],
  };
};
