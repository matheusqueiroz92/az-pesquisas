/**
 * Content-Security-Policy with a per-request nonce (spec 007, rule 14): Next.js
 * puts the nonce on its own scripts; any other script is blocked.
 */
export const contentSecurityPolicy = (nonce: string, options: { dev: boolean }): string =>
  [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${options.dev ? " 'unsafe-eval'" : ''}`,
    // Tailwind and Next inject style tags; styles cannot run code.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
