import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { T0 } from '@/test/fixtures';

import { TimeRangePanel } from './TimeRangePanel';

const dataset = { start: T0, end: T0 + 3 * 86400 + 60 };

describe('TimeRangePanel', () => {
  const setup = (range: [number, number] = [dataset.start, dataset.end]) => {
    const onChange = vi.fn();
    render(<TimeRangePanel dataset={dataset} range={range} onChange={onChange} />);
    return onChange;
  };

  it('offers one preset per UTC day (ignoring a trailing 1-minute sliver)', () => {
    setup();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Full',
      'D1',
      'D2',
      'D3',
    ]);
  });

  it('selects a day', async () => {
    const onChange = setup();
    await userEvent.click(screen.getByRole('button', { name: 'D2' }));
    expect(onChange).toHaveBeenCalledWith([T0 + 86400, T0 + 2 * 86400]);
  });

  it('resets to the full extent (null) from the Full preset', async () => {
    const onChange = setup([T0 + 100, T0 + 200]);
    await userEvent.click(screen.getByRole('button', { name: 'Full' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('shows the window duration', () => {
    setup([T0, T0 + 5400]);
    expect(screen.getByText('1h 30m')).toBeInTheDocument();
  });
});
