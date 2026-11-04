import { webEnv } from './env';

/**
 * Headers worth passing to the API: the client IP (the API throttles login by
 * IP; without it every login would count against the panel's own address),
 * the user agent (audit log) and the request id (log correlation).
 */
export const forwardedHeaders = (incoming: Headers): Headers => {
  const headers = new Headers();
  const forwardedFor = incoming.get('x-forwarded-for') ?? incoming.get('x-real-ip');
  if (forwardedFor) {
    headers.set('x-forwarded-for', forwardedFor);
  }
  for (const name of ['user-agent', 'x-request-id']) {
    const value = incoming.get(name);
    if (value) {
      headers.set(name, value);
    }
  }
  return headers;
};

export interface UpstreamRequest {
  readonly method: string;
  readonly incoming: Headers;
  readonly accessToken?: string | undefined;
  readonly body?: string | undefined;
  readonly search?: string | undefined;
}

/** Calls the API from the panel's server. `path` starts with /v1/. */
export const callApi = (path: string, request: UpstreamRequest): Promise<Response> => {
  const url = new URL(path, webEnv().apiUrl);
  url.search = request.search ?? '';
  const headers = forwardedHeaders(request.incoming);
  headers.set('accept', 'application/json');
  if (request.accessToken) {
    headers.set('authorization', `Bearer ${request.accessToken}`);
  }
  if (request.body !== undefined) {
    headers.set('content-type', 'application/json');
  }
  return fetch(url, {
    method: request.method,
    headers,
    body: request.body,
    cache: 'no-store',
    redirect: 'manual',
  });
};
