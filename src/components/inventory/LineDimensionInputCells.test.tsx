import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LineDimensionInputCells } from './LineDimensionInputCells';

type Dims = { length: string; width: string; slabs: string };
const BLANK: Dims = { length: '', width: '', slabs: '' };

// The cells live in a document form in the app; the submit spy stands in for
// "the whole document got saved".
function Harness({ initial = BLANK, enabled = true, onSubmit }: { initial?: Dims; enabled?: boolean; onSubmit: () => void }) {
  const [dims, setDims] = useState<Dims>(initial);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <table>
        <tbody>
          <tr>
            <LineDimensionInputCells
              dims={dims}
              unit="in"
              enabled={enabled}
              onChange={(key, value) => setDims((prev) => ({ ...prev, [key]: value }))}
            />
            <td><input aria-label="Units" /></td>
          </tr>
        </tbody>
      </table>
      <button type="submit">Save order</button>
    </form>
  );
}

const length = () => screen.getByRole('textbox', { name: 'Length (in)' }) as HTMLInputElement;
const width = () => screen.getByRole('textbox', { name: 'Width (in)' }) as HTMLInputElement;
const slabs = () => screen.getByRole('textbox', { name: 'Slabs' }) as HTMLInputElement;

describe('LineDimensionInputCells', () => {
  it('is a plain text box with a number keypad, so no spinner or scroll-wheel stepping', () => {
    render(<Harness onSubmit={vi.fn()} />);
    expect(length()).toHaveAttribute('type', 'text');
    expect(length()).toHaveAttribute('inputmode', 'decimal');
    expect(slabs()).toHaveAttribute('inputmode', 'numeric');
  });

  it('drops anything that is not part of the number as it is typed', async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={vi.fn()} />);

    await user.type(length(), '1,2a0.555');
    expect(length()).toHaveValue('120.55');

    await user.type(slabs(), '-3.7');
    expect(slabs()).toHaveValue('37');
  });

  it('turns a pasted figure into the number it means', async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={vi.fn()} />);

    await user.click(width());
    await user.paste('1,200.5 in');
    expect(width()).toHaveValue('1200.5');
  });

  it('selects the whole value on focus so typing replaces it', () => {
    render(<Harness initial={{ length: '300', width: '', slabs: '' }} onSubmit={vi.fn()} />);

    length().focus();
    expect(length().selectionStart).toBe(0);
    expect(length().selectionEnd).toBe(3);
  });

  it('moves to the next box on Enter and never saves the document', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await user.type(length(), '120{Enter}');
    expect(width()).toHaveFocus();
    await user.type(width(), '60{Enter}');
    expect(slabs()).toHaveFocus();
    await user.type(slabs(), '2{Enter}');
    expect(screen.getByRole('textbox', { name: 'Units' })).toHaveFocus();

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('steps with the arrow keys, ten at a time with Shift, never below the floor', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ length: '5', width: '', slabs: '' }} onSubmit={vi.fn()} />);

    length().focus();
    await user.keyboard('{ArrowUp}');
    expect(length()).toHaveValue('6');
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}');
    expect(length()).toHaveValue('16');
    await user.keyboard('{Shift>}{ArrowDown}{ArrowDown}{/Shift}');
    expect(length()).toHaveValue('0');

    slabs().focus();
    await user.keyboard('{ArrowDown}');
    expect(slabs()).toHaveValue('1'); // a blank slab count is one
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(slabs()).toHaveValue('3');
  });

  it('shows the boxes blank and disabled, with the hint, when the line cannot be sized', () => {
    render(<Harness initial={{ length: '300', width: '150', slabs: '2' }} enabled={false} onSubmit={vi.fn()} />);

    for (const box of [length(), width(), slabs()]) {
      expect(box).toBeDisabled();
      expect(box).toHaveValue('');
      expect(box).toHaveAttribute('title', expect.stringContaining('sq ft'));
    }
  });
});
