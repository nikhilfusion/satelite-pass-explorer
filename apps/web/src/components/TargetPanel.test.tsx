import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { T0 } from '@/test/fixtures';

import { TargetPanel } from './TargetPanel';

const dataset = { start: T0, end: T0 + 86400 };

const setup = (over: Partial<Parameters<typeof TargetPanel>[0]> = {}) => {
  const handlers = { onTarget: vi.fn(), onRadius: vi.fn(), onCustomWindow: vi.fn() };
  render(
    <TargetPanel
      target={null}
      radiusKm={500}
      mapRange={[dataset.start, dataset.end]}
      customWindow={null}
      dataset={dataset}
      {...handlers}
      {...over}
    />,
  );
  return handlers;
};

describe('TargetPanel', () => {
  it('prompts for a click when no target is set', () => {
    setup();
    expect(screen.getByText(/Click anywhere on the map/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('picks a preset city and asks the map to fly there', async () => {
    const { onTarget } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Dubai' }));
    expect(onTarget).toHaveBeenCalledWith({ lat: 25.2048, lon: 55.2708 }, { fly: true });
  });

  it('commits typed coordinates (clamped) on Enter', async () => {
    const { onTarget } = setup();
    await userEvent.type(screen.getByPlaceholderText('25.2048'), '95');
    await userEvent.type(screen.getByPlaceholderText('55.2708'), '10{Enter}');
    expect(onTarget).toHaveBeenCalledWith({ lat: 90, lon: 10 }, { fly: true });
  });

  it('shows the target, a Clear button and formatted coordinates', async () => {
    const { onTarget } = setup({ target: { lat: -33.8688, lon: 151.2093 } });
    expect(screen.getByText(/33.869°S/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onTarget).toHaveBeenCalledWith(null);
  });

  it('changes the radius logarithmically', () => {
    const { onRadius } = setup();
    fireEvent.change(screen.getByRole('slider', { name: 'Radius in kilometres' }), {
      target: { value: '1000' },
    });
    expect(onRadius).toHaveBeenCalledWith(3000);
  });

  it('switches between following the map range and a custom window', async () => {
    const { onCustomWindow } = setup();
    await userEvent.click(screen.getByRole('checkbox', { name: /Use the map time range/ }));
    expect(onCustomWindow).toHaveBeenCalledWith([dataset.start, dataset.end]);
  });

  it('disables the window fields while following the map range', () => {
    setup();
    expect(screen.getByLabelText(/Start/)).toBeDisabled();
  });
});
