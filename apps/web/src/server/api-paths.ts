// Paths under /v1 the browser may reach through the panel's data proxy.
// Login, refresh and logout are NOT here: tokens only move through /api/auth/*.
const AUTH_EXCEPTIONS: readonly { path: string; method: string }[] = [
  { path: 'auth/me', method: 'GET' },
  { path: 'auth/password', method: 'POST' },
];

const SAFE_SEGMENT = /^[A-Za-z0-9_-]+$/;

export const isProxyablePath = (segments: readonly string[], method: string): boolean => {
  if (segments.length === 0 || !segments.every((s) => SAFE_SEGMENT.test(s))) {
    return false;
  }
  if (segments[0] === 'auth') {
    const path = segments.join('/');
    return AUTH_EXCEPTIONS.some((e) => e.path === path && e.method === method.toUpperCase());
  }
  return true;
};
