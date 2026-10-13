import {
  type AccessesQuery,
  type AccessesResponse,
  AccessesResponseSchema,
  ApiErrorSchema,
  type MetaResponse,
  MetaResponseSchema,
  type TracksResponse,
} from '@sat/contract';

import { isTracksResponse } from '@/lib/tracks';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function request(url: string, signal?: AbortSignal): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { signal, headers: { accept: 'application/json' } });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiRequestError('Cannot reach the API — is the server running?', 0);
  }
  if (!res.ok) {
    const parsed = ApiErrorSchema.safeParse(await res.json().catch(() => null));
    throw new ApiRequestError(
      parsed.success ? parsed.data.error.message : `Request failed (${res.status})`,
      res.status,
      parsed.success ? parsed.data.error.code : undefined,
    );
  }
  return res.json();
}

export async function fetchMeta(signal?: AbortSignal): Promise<MetaResponse> {
  return MetaResponseSchema.parse(await request('/api/meta', signal));
}

export async function fetchTracks(signal?: AbortSignal): Promise<TracksResponse> {
  const data = await request('/api/tracks', signal);
  if (!isTracksResponse(data)) throw new ApiRequestError('Malformed /api/tracks payload', 200);
  return data;
}

export function accessesUrl(q: AccessesQuery): string {
  const params = new URLSearchParams({
    lat: q.lat.toFixed(5),
    lon: q.lon.toFixed(5),
    radiusKm: String(q.radiusKm),
    from: q.from,
    to: q.to,
  });
  if (q.satellites?.length) params.set('satellites', q.satellites.join(','));
  return `/api/accesses?${params}`;
}

export async function fetchAccesses(
  q: AccessesQuery,
  signal?: AbortSignal,
): Promise<AccessesResponse> {
  return AccessesResponseSchema.parse(await request(accessesUrl(q), signal));
}
