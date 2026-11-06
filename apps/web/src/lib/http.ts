/** Browser-side calls to the panel's own /api routes (never straight to the API). */
export type SendResult<T> =
  { ok: true; data: T } | { ok: false; status: number; code: string | undefined; fields: string[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
};

const failure = (status: number, body: unknown): SendResult<never> => {
  const code = isRecord(body) && typeof body['code'] === 'string' ? body['code'] : undefined;
  const errors = isRecord(body) && Array.isArray(body['errors']) ? body['errors'] : [];
  const fields = errors.flatMap((e: unknown) =>
    isRecord(e) && typeof e['field'] === 'string' ? [e['field']] : [],
  );
  return { ok: false, status, code, fields };
};

export const send = async <T = unknown>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  url: string,
  body?: unknown,
): Promise<SendResult<T>> => {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch {
    return failure(0, undefined);
  }
  if (!response.ok) {
    return failure(response.status, await parseJson(response));
  }
  if (response.status === 204) {
    return { ok: true, data: undefined as T };
  }
  return { ok: true, data: (await parseJson(response)) as T };
};
