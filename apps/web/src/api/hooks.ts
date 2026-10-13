import type { AccessesQuery } from '@sat/contract';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { fetchAccesses, fetchMeta, fetchTracks } from './client';

/** Dataset facts are immutable per server build, so they are never refetched. */
export const useMeta = () =>
  useQuery({
    queryKey: ['meta'],
    queryFn: ({ signal }) => fetchMeta(signal),
    staleTime: Infinity,
  });

export const useTracks = () =>
  useQuery({
    queryKey: ['tracks'],
    queryFn: ({ signal }) => fetchTracks(signal),
    staleTime: Infinity,
    gcTime: Infinity,
  });

/**
 * Accesses for the current target. `placeholderData` keeps the previous result on screen
 * while a new radius/window is loading, so the list never flashes empty; the aborted
 * `signal` cancels stale requests while the user drags a slider.
 */
export const useAccesses = (query: AccessesQuery | null) =>
  useQuery({
    queryKey: ['accesses', query],
    queryFn: ({ signal }) => fetchAccesses(query as AccessesQuery, signal),
    enabled: query !== null,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
