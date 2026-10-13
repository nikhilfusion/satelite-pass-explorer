import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { colors, meta } from '@/test/fixtures';

import { SatellitePanel } from './SatellitePanel';

const setup = (hidden: string[] = [], counts?: Record<string, number>) => {
  const onToggle = vi.fn();
  const onSetHidden = vi.fn();
  render(
    <SatellitePanel
      satellites={meta.satellites}
      colors={colors}
      hidden={hidden}
      counts={counts}
      onToggle={onToggle}
      onSetHidden={onSetHidden}
    />,
  );
  return { onToggle, onSetHidden };
};

describe('SatellitePanel', () => {
  it('shows how many satellites are visible', () => {
    setup(['SAT-B']);
    expect(screen.getByText('2/3')).toBeInTheDocument();
  });

  it('toggles a single satellite', async () => {
    const { onToggle } = setup();
    await userEvent.click(screen.getByRole('checkbox', { name: /SAT-B/ }));
    expect(onToggle).toHaveBeenCalledWith('SAT-B');
  });

  it('supports All / None / Invert', async () => {
    const { onSetHidden } = setup(['SAT-A']);
    await userEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(onSetHidden).toHaveBeenLastCalledWith([]);
    await userEvent.click(screen.getByRole('button', { name: 'None' }));
    expect(onSetHidden).toHaveBeenLastCalledWith(['SAT-A', 'SAT-B', 'SAT-C']);
    await userEvent.click(screen.getByRole('button', { name: 'Invert' }));
    expect(onSetHidden).toHaveBeenLastCalledWith(['SAT-B', 'SAT-C']);
  });

  it('can solo a satellite', async () => {
    const { onSetHidden } = setup();
    const row = screen.getByRole('checkbox', { name: /SAT-C/ }).closest('li') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'only' }));
    expect(onSetHidden).toHaveBeenCalledWith(['SAT-A', 'SAT-B']);
  });

  it('shows per-satellite pass counts for visible satellites only', () => {
    setup(['SAT-B'], { 'SAT-A': 4, 'SAT-B': 9 });
    const chips = screen.getAllByTitle('passes over the target').map((c) => c.textContent);
    expect(chips).toEqual(['4', '0']); // SAT-A and SAT-C; hidden SAT-B shows no chip
    expect(screen.queryByText('9')).not.toBeInTheDocument();
  });
});
