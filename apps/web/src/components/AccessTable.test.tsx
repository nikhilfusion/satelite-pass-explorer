import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { accesses, colors } from '@/test/fixtures';

import { AccessTable } from './AccessTable';

const setup = (over: Partial<Parameters<typeof AccessTable>[0]> = {}) => {
  const onHover = vi.fn();
  const onSelect = vi.fn();
  render(
    <AccessTable
      accesses={accesses}
      colors={colors}
      sort="time"
      hoveredId={null}
      selectedId={null}
      onHover={onHover}
      onSelect={onSelect}
      {...over}
    />,
  );
  return { onHover, onSelect };
};

describe('AccessTable', () => {
  it('groups passes by UTC day with a header per day', () => {
    setup();
    expect(screen.getByRole('heading', { name: '2027-03-01' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2027-03-02' })).toBeInTheDocument();
    expect(screen.getAllByTestId('access-row')).toHaveLength(3);
  });

  it('formats times, duration, elevation and distance', () => {
    setup();
    const row = screen.getAllByTestId('access-row')[0] as HTMLElement;
    expect(within(row).getByText(/01:00:00/)).toBeInTheDocument();
    expect(within(row).getByText('2m 00s')).toBeInTheDocument();
    expect(within(row).getByText('80.0°')).toBeInTheDocument();
    expect(within(row).getByText('100 km')).toBeInTheDocument();
  });

  it('reports hover and toggles selection on click', async () => {
    const { onHover, onSelect } = setup({ selectedId: 'SAT-B-1' });
    const rows = screen.getAllByTestId('access-row');
    await userEvent.hover(rows[0] as HTMLElement);
    expect(onHover).toHaveBeenLastCalledWith('SAT-A-1');
    await userEvent.unhover(rows[0] as HTMLElement);
    expect(onHover).toHaveBeenLastCalledWith(null);

    await userEvent.click(rows[0] as HTMLElement);
    expect(onSelect).toHaveBeenLastCalledWith('SAT-A-1');
    await userEvent.click(rows[1] as HTMLElement); // already selected -> deselect
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('marks hovered and selected rows for styling', () => {
    setup({ hoveredId: 'SAT-A-1', selectedId: 'SAT-A-2' });
    const rows = screen.getAllByTestId('access-row');
    expect(rows[0]).toHaveAttribute('data-hover', 'true');
    expect(rows[2]).toHaveAttribute('data-selected', 'true');
  });

  it('ranks by elevation without day headers', () => {
    setup({ sort: 'elevation' });
    const first = screen.getAllByTestId('access-row')[0] as HTMLElement;
    expect(within(first).getByText('80.0°')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '2027-03-01' })).not.toBeInTheDocument();
  });

  it('shows an empty state', () => {
    setup({ accesses: [] });
    expect(screen.getByText(/No accesses/)).toBeInTheDocument();
  });
});
