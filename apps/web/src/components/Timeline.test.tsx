import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { accesses, colors, T0 } from '@/test/fixtures';

import { Timeline } from './Timeline';

describe('Timeline', () => {
  const setup = () => {
    const onSelect = vi.fn();
    const onHover = vi.fn();
    render(
      <Timeline
        satellites={['SAT-A', 'SAT-B', 'SAT-C']}
        accesses={accesses}
        window={[T0, T0 + 3 * 86400]}
        colors={colors}
        hoveredId={null}
        selectedId="SAT-B-1"
        onHover={onHover}
        onSelect={onSelect}
      />,
    );
    return { onSelect, onHover };
  };

  it('renders one lane per satellite and one bar per pass', () => {
    setup();
    for (const s of ['SAT-A', 'SAT-B', 'SAT-C']) expect(screen.getByText(s)).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('highlights the selected pass and forwards interaction', async () => {
    const { onSelect, onHover } = setup();
    const bars = screen.getAllByRole('button');
    expect(bars.filter((b) => b.getAttribute('data-selected') === 'true')).toHaveLength(1);
    await userEvent.hover(bars[0] as HTMLElement);
    expect(onHover).toHaveBeenCalledWith('SAT-A-1');
    await userEvent.click(bars[0] as HTMLElement);
    expect(onSelect).toHaveBeenCalledWith('SAT-A-1');
  });
});
