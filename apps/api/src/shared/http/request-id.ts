import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

// Letters, digits and hyphens only: an id copied into logs and response headers
// must not carry spaces, line breaks (header injection) or unbounded length.
const SAFE_REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

/** Reuses a safe incoming request id (e.g. from Traefik or the web BFF), otherwise creates one. */
export const resolveRequestId = (incoming: string | string[] | undefined): string =>
  typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
