import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initialState, useExplorer } from '@/state/store';
import { accesses, accessesResponse, meta, tracks } from '@/test/fixtures';

import { App } from './App';

// MapLibre needs WebGL; the map is exercised in the Playwright e2e suite instead.
const mapProps = vi.fn();
vi.mock('@/map/MapView', () => ({
  MapView: (
    props: Record<string, unknown> & { onPickTarget: (t: { lat: number; lon: number }) => void },
  ) => {
    mapProps(props);
    return (
      <button data-testid="fake-map" onClick={() => props.onPickTarget({ lat: 10, lon: 20 })}>
        map
      </button>
    );
  },
}));

const fetchMock = vi.fn();

function respond(url: string): Response {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (url.startsWith('/api/meta')) return json(meta);
  if (url.startsWith('/api/tracks')) return json(tracks);
  if (url.startsWith('/api/accesses')) return json(accessesResponse());
  return json({ error: { code: 'NOT_FOUND', message: 'nope' } }, 404);
}

const renderApp = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <App />
    </QueryClientProvider>,
  );

beforeEach(() => {
  useExplorer.setState({ ...initialState });
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) => Promise.resolve(respond(url)));
  vi.stubGlobal('fetch', fetchMock);
  mapProps.mockClear();
});

afterEach(() => vi.unstubAllGlobals());

describe('App', () => {
  it('loads the dataset and renders the controls', async () => {
    renderApp();
    expect(await screen.findByRole('checkbox', { name: /SAT-A/ })).toBeInTheDocument();
    expect(screen.getByText(/100 segments · 3 satellites/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Accesses' })).not.toBeInTheDocument();
  });

  it('lists accesses after picking a target and syncs the URL', async () => {
    renderApp();
    await screen.findByRole('checkbox', { name: /SAT-A/ });
    await userEvent.click(screen.getByRole('button', { name: 'Dubai' }));

    const rows = await screen.findAllByTestId('access-row');
    expect(rows).toHaveLength(accesses.length);
    expect(screen.getByTestId('access-summary')).toHaveTextContent('3 passes');

    const url = fetchMock.mock.calls
      .map((c) => String(c[0]))
      .find((u) => u.startsWith('/api/accesses'));
    expect(url).toContain('lat=25.20480');
    expect(url).toContain('radiusKm=500');
    expect(url).not.toContain('satellites='); // everything visible => no filter sent

    await waitFor(() => expect(window.location.search).toContain('lat=25.2048'));
  });

  it('passes only the visible satellites to the accesses query', async () => {
    renderApp();
    await userEvent.click(await screen.findByRole('checkbox', { name: /SAT-B/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Tokyo' }));
    await screen.findAllByTestId('access-row');
    const url = fetchMock.mock.calls
      .map((c) => String(c[0]))
      .find((u) => u.startsWith('/api/accesses'));
    expect(decodeURIComponent(url ?? '')).toContain('satellites=SAT-A,SAT-C');
  });

  it('selects a pass from the list (shared selection state)', async () => {
    renderApp();
    await screen.findByRole('checkbox', { name: /SAT-A/ });
    await userEvent.click(screen.getByTestId('fake-map')); // map click -> target
    const rows = await screen.findAllByTestId('access-row');
    await userEvent.click(rows[1] as HTMLElement);
    expect(useExplorer.getState().selectedId).toBe('SAT-B-1');
    expect(rows[1]).toHaveAttribute('data-selected', 'true');
  });

  it('clears the list when the target is cleared', async () => {
    renderApp();
    await screen.findByRole('checkbox', { name: /SAT-A/ });
    await userEvent.click(screen.getByRole('button', { name: 'Paris' }));
    await screen.findAllByTestId('access-row');
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(screen.queryByTestId('access-row')).not.toBeInTheDocument());
  });

  it('shows an actionable error when the API is down', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    renderApp();
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(/Cannot reach the API/)).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
