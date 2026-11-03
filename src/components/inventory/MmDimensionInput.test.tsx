import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MmDimensionInput } from './MmDimensionInput';

// What a slab keeps is millimetres; what the receiver sees and types is the item's unit.
function Harness({ initial, unit, onMm }: { initial: string; unit: string; onMm?: (mm: string) => void }) {
  const [mm, setMm] = useState(initial);
  return (
    <MmDimensionInput
      valueMm={mm} unit={unit} label="Length"
      onChangeMm={(v) => { setMm(v); onMm?.(v); }}
    />
  );
}

describe('MmDimensionInput', () => {
  it('shows a stored millimetre size in the item\'s unit', () => {
    render(<Harness initial="3048" unit="in" />);

    expect(screen.getByRole('spinbutton', { name: 'Length' })).toHaveValue(120);
  });

  it('keeps millimetres when the item is measured in millimetres', () => {
    render(<Harness initial="3048" unit="mm" />);

    expect(screen.getByRole('spinbutton', { name: 'Length' })).toHaveValue(3048);
  });

  it('turns what is typed back into millimetres', async () => {
    const onMm = vi.fn();
    render(<Harness initial="" unit="in" onMm={onMm} />);

    await userEvent.setup().type(screen.getByRole('spinbutton', { name: 'Length' }), '120');

    expect(onMm).toHaveBeenLastCalledWith('3048');
  });

  it('leaves what is being typed alone, even when it is only part of a number', async () => {
    render(<Harness initial="" unit="in" />);
    const input = screen.getByRole('spinbutton', { name: 'Length' });

    await userEvent.setup().type(input, '96.5');

    expect(input).toHaveValue(96.5);
  });

  it('keeps a finer figure than a millimetre can hold while it is being typed', async () => {
    render(<Harness initial="" unit="in" />);
    const input = screen.getByRole('spinbutton', { name: 'Length' });

    await userEvent.setup().type(input, '1.181');

    expect(input).toHaveValue(1.181);
  });

  it('shows a blank as blank', () => {
    render(<Harness initial="" unit="in" />);

    expect(screen.getByRole('spinbutton', { name: 'Length' })).toHaveValue(null);
  });

  it('follows a size changed from outside, such as a bulk fill', () => {
    const { rerender } = render(<MmDimensionInput valueMm="3048" unit="in" label="Length" onChangeMm={() => {}} />);

    rerender(<MmDimensionInput valueMm="2438.4" unit="in" label="Length" onChangeMm={() => {}} />);

    expect(screen.getByRole('spinbutton', { name: 'Length' })).toHaveValue(96);
  });
});
