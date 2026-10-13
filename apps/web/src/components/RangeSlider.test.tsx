import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RangeSlider } from './RangeSlider';

const setup = (value: [number, number] = [100, 500]) => {
  const onChange = vi.fn();
  render(
    <RangeSlider
      min={0}
      max={1000}
      step={10}
      value={value}
      onChange={onChange}
      formatValue={(v) => `t=${v}`}
    />,
  );
  return onChange;
};

describe('RangeSlider', () => {
  it('exposes both handles as accessible sliders with values', () => {
    setup();
    const start = screen.getByRole('slider', { name: 'Range start' });
    const end = screen.getByRole('slider', { name: 'Range end' });
    expect(start).toHaveAttribute('aria-valuenow', '100');
    expect(end).toHaveAttribute('aria-valuetext', 't=500');
  });

  it('moves a handle with the arrow keys (5 steps), shift for a big jump', () => {
    const onChange = setup();
    const start = screen.getByRole('slider', { name: 'Range start' });
    fireEvent.keyDown(start, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith([150, 500]);
    fireEvent.keyDown(start, { key: 'ArrowLeft', shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith([0, 500]); // clamped at min
  });

  it('never lets handles cross', () => {
    const onChange = setup([100, 120]);
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Range start' }), {
      key: 'ArrowRight',
      shiftKey: true,
    });
    expect(onChange).toHaveBeenLastCalledWith([110, 120]);
  });

  it('ignores unrelated keys', () => {
    const onChange = setup();
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Range end' }), { key: 'a' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('drags a handle with the pointer', () => {
    const onChange = setup();
    const track = screen.getByRole('slider', { name: 'Range end' }).parentElement as HTMLElement;
    track.getBoundingClientRect = () => ({
      left: 0,
      width: 1000,
      top: 0,
      height: 6,
      right: 1000,
      bottom: 6,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const end = screen.getByRole('slider', { name: 'Range end' });
    // jsdom's PointerEvent drops clientX, so dispatch MouseEvents carrying the pointer type.
    const pointer = (type: string, clientX = 0) =>
      fireEvent(
        end,
        Object.assign(new MouseEvent(type, { bubbles: true, clientX }), { pointerId: 1 }),
      );
    pointer('pointerdown', 500);
    pointer('pointermove', 800);
    expect(onChange).toHaveBeenLastCalledWith([100, 800]);
    pointer('pointerup');
    pointer('pointermove', 900);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
