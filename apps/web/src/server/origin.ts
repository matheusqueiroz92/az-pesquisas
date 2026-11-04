const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Second CSRF barrier after SameSite=Lax: a state-changing request must come
 * from the panel's own origin. Behind Traefik the public host arrives in
 * X-Forwarded-Host.
 */
export const isSameOrigin = (method: string, headers: Headers): boolean => {
  if (SAFE_METHODS.has(method.toUpperCase())) {
    return true;
  }
  const origin = headers.get('origin');
  const host = headers.get('x-forwarded-host') ?? headers.get('host');
  if (!origin || !host) {
    return false;
  }
  try {
    return new URL(origin).host === host.split(',')[0]?.trim();
  } catch {
    return false;
  }
};
