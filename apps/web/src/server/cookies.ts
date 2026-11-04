export const SESSION_COOKIES = { access: 'az_at', refresh: 'az_rt' } as const;

export type AppEnv = 'local' | 'staging' | 'production';

export interface CookieToSet {
  readonly name: string;
  readonly value: string;
  readonly options: {
    readonly httpOnly: true;
    readonly sameSite: 'lax';
    readonly secure: boolean;
    readonly path: '/';
    readonly maxAge: number;
  };
}

// httpOnly: no JavaScript can read the tokens. SameSite=Lax: other sites cannot
// send them in a POST. Secure everywhere except local HTTP development.
const base = (appEnv: AppEnv) =>
  ({ httpOnly: true, sameSite: 'lax', secure: appEnv !== 'local', path: '/' }) as const;

const secondsUntil = (iso: string, now: number): number =>
  Math.max(0, Math.floor((Date.parse(iso) - now) / 1000));

/** Expires together with the token, so a missing cookie means "expired". */
export const accessTokenCookie = (
  token: string,
  expiresAt: string,
  appEnv: AppEnv,
  now = Date.now(),
): CookieToSet => ({
  name: SESSION_COOKIES.access,
  value: token,
  options: { ...base(appEnv), maxAge: secondsUntil(expiresAt, now) },
});

export const refreshTokenCookie = (
  token: string,
  expiresAt: string,
  appEnv: AppEnv,
  now = Date.now(),
): CookieToSet => ({
  name: SESSION_COOKIES.refresh,
  value: token,
  options: { ...base(appEnv), maxAge: secondsUntil(expiresAt, now) },
});

export const clearedCookie = (name: string, appEnv: AppEnv): CookieToSet => ({
  name,
  value: '',
  options: { ...base(appEnv), maxAge: 0 },
});
