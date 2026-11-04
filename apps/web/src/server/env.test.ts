import { describe, expect, it } from 'vitest';

import { webEnv } from './env';

describe('webEnv', () => {
  it('defaults to the local API', () => {
    expect(webEnv({})).toEqual({ apiUrl: 'http://localhost:3000', appEnv: 'local' });
  });

  it('reads API_URL and APP_ENV', () => {
    expect(webEnv({ API_URL: 'http://api:3000', APP_ENV: 'production' })).toEqual({
      apiUrl: 'http://api:3000',
      appEnv: 'production',
    });
  });

  it('refuses an unknown APP_ENV or a malformed URL', () => {
    expect(() => webEnv({ APP_ENV: 'prod' })).toThrow('APP_ENV');
    expect(() => webEnv({ API_URL: 'not a url' })).toThrow();
  });
});
