import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { T0 } from '@/test/fixtures';

import { DateTimeField } from './DateTimeField';

const setup = (min?: number, max?: number) => {
  const onCommit = vi.fn();
  render(<DateTimeField label="From" value={T0} min={min} max={max} onCommit={onCommit} />);
  return { onCommit, input: screen.getByLabelText(/From/) as HTMLInputElement };
};

describe('DateTimeField', () => {
  it('shows the UTC value', () => {
    expect(setup().input.value).toBe('2027-03-01 00:00');
  });

  it('commits a valid value on Enter', async () => {
    const { onCommit, input } = setup();
    await userEvent.clear(input);
    await userEvent.type(input, '2027-03-02 06:30{Enter}');
    expect(onCommit).toHaveBeenCalledWith(Date.parse('2027-03-02T06:30:00Z') / 1000);
  });

  it('reverts invalid text on blur and flags it while typing', async () => {
    const { onCommit, input } = setup();
    await userEvent.clear(input);
    await userEvent.type(input, 'nonsense');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    await userEvent.tab();
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe('2027-03-01 00:00');
  });

  it('rejects values outside [min, max]', async () => {
    const { onCommit, input } = setup(T0, T0 + 3600);
    await userEvent.clear(input);
    await userEvent.type(input, '2027-03-05 00:00{Enter}');
    expect(onCommit).not.toHaveBeenCalled();
  });
});
