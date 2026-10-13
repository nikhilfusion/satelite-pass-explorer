import { create } from 'zustand';

export type ProjectionMode = 'globe' | 'mercator';

export interface Target {
  lat: number;
  lon: number;
}

export interface ExplorerState {
  /** Satellites switched OFF (empty = everything visible; independent of catalogue load). */
  hidden: string[];
  /** Map time filter, epoch s. `null` = full dataset extent. */
  range: [number, number] | null;
  target: Target | null;
  radiusKm: number;
  /** Access window: follows the map filter unless a custom one is set. */
  customWindow: [number, number] | null;
  hoveredId: string | null;
  selectedId: string | null;
  projection: ProjectionMode;

  toggleSatellite: (id: string) => void;
  setHidden: (ids: string[]) => void;
  setRange: (range: [number, number] | null) => void;
  setTarget: (target: Target | null) => void;
  setRadiusKm: (km: number) => void;
  setCustomWindow: (w: [number, number] | null) => void;
  setHovered: (id: string | null) => void;
  setSelected: (id: string | null) => void;
  setProjection: (p: ProjectionMode) => void;
}

export const DEFAULT_RADIUS_KM = 500;

export const initialState = {
  hidden: [],
  range: null,
  target: null,
  radiusKm: DEFAULT_RADIUS_KM,
  customWindow: null,
  hoveredId: null,
  selectedId: null,
  projection: 'globe' as ProjectionMode,
} satisfies Partial<ExplorerState>;

export const useExplorer = create<ExplorerState>()((set) => ({
  ...initialState,
  toggleSatellite: (id) =>
    set((s) => ({
      hidden: s.hidden.includes(id) ? s.hidden.filter((h) => h !== id) : [...s.hidden, id],
    })),
  setHidden: (hidden) => set({ hidden }),
  setRange: (range) => set({ range }),
  // A new target invalidates any previous pass selection.
  setTarget: (target) => set({ target, selectedId: null, hoveredId: null }),
  setRadiusKm: (radiusKm) => set({ radiusKm }),
  setCustomWindow: (customWindow) => set({ customWindow }),
  setHovered: (hoveredId) => set({ hoveredId }),
  setSelected: (selectedId) => set({ selectedId }),
  setProjection: (projection) => set({ projection }),
}));

/* ---------- derived selectors (pure, easy to test) ---------- */

export const visibleSatellites = (all: readonly string[], hidden: readonly string[]) =>
  all.filter((s) => !hidden.includes(s));

export function effectiveRange(
  range: [number, number] | null,
  dataset: { start: number; end: number },
): [number, number] {
  return range ?? [dataset.start, dataset.end];
}

export function effectiveWindow(
  s: Pick<ExplorerState, 'customWindow' | 'range'>,
  dataset: { start: number; end: number },
): [number, number] {
  return s.customWindow ?? effectiveRange(s.range, dataset);
}
