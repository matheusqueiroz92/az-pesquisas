import type { AppEnv } from './cookies';

const APP_ENVS: readonly AppEnv[] = ['local', 'staging', 'production'];

export interface WebEnv {
  /** Where the panel's server reaches the API (internal network in production). */
  readonly apiUrl: string;
  readonly appEnv: AppEnv;
}

/** Read lazily: `next build` runs without the runtime variables. */
export const webEnv = (
  source: Readonly<Record<string, string | undefined>> = process.env,
): WebEnv => {
  const apiUrl = source['API_URL'] ?? 'http://localhost:3000';
  const appEnv = (source['APP_ENV'] ?? 'local') as AppEnv;
  if (!APP_ENVS.includes(appEnv)) {
    throw new Error(`APP_ENV must be one of ${APP_ENVS.join(', ')}`);
  }
  new URL(apiUrl); // throws on a malformed URL
  return { apiUrl, appEnv };
};
