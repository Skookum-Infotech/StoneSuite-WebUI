import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LineSizeInputCells, LineSizeViewCells, SIZE_COLUMN_COUNT } from './LineSizeCells';

const BLANK = { length: '', width: '', slabs: '', thickness: '' };

function InTable({ children }: { children: React.ReactNode }) {
  return <table><tbody><tr>{children}</tr></tbody></table>;
}

describe('LineSizeInputCells', () => {
  it('shows length, width, slabs and thickness boxes for a square-foot line', () => {
    render(<InTable><LineSizeInputCells dims={BLANK} dimensionUnit="in" units="SQFT" onChange={() => undefined} /></InTable>);
    for (const name of ['Length (in)', 'Width (in)', 'Slabs', 'Thickness (in)']) {
      expect(screen.getByRole('textbox', { name })).toBeEnabled();
    }
  });

  it('shows the boxes, disabled, while no item is picked yet', () => {
    render(<InTable><LineSizeInputCells dims={BLANK} dimensionUnit={undefined} units="" onChange={() => undefined} /></InTable>);
    expect(screen.getByRole('textbox', { name: 'Length (in)' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Thickness (in)' })).toBeDisabled();
  });

  it.each(['EA', 'LF', 'SET'])('folds into one merged cell for a %s line', (units) => {
    render(<InTable><LineSizeInputCells dims={BLANK} dimensionUnit="in" units={units} onChange={() => undefined} /></InTable>);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.getByRole('cell')).toHaveAttribute('colspan', String(SIZE_COLUMN_COUNT));
  });
});

describe('LineSizeViewCells', () => {
  it('shows the size, slab count and thickness with their unit', () => {
    render(<InTable><LineSizeViewCells size={{ length: 120, width: 60, slabs: 2, thickness: 0.75 }} unit="in" units="SQFT" /></InTable>);
    const cells = screen.getAllByRole('cell').map((c) => c.textContent);
    expect(cells).toEqual(['120 in', '60 in', '0.75 in', '2']);
  });

  it('folds a piece-priced line with no size into one merged dash', () => {
    render(<InTable><LineSizeViewCells size={{}} unit="in" units="EA" /></InTable>);
    const cell = screen.getByRole('cell');
    expect(cell).toHaveAttribute('colspan', String(SIZE_COLUMN_COUNT));
    expect(cell).toHaveTextContent('—');
  });

  it('still shows a size a non-area line somehow carries, so nothing saved is hidden', () => {
    render(<InTable><LineSizeViewCells size={{ length: 10, width: 5 }} unit="in" units="EA" /></InTable>);
    expect(screen.getAllByRole('cell')).toHaveLength(SIZE_COLUMN_COUNT);
  });

  it('keeps four dashes for a square-foot line that has no size yet', () => {
    render(<InTable><LineSizeViewCells size={{}} unit="in" units="SQFT" /></InTable>);
    expect(screen.getAllByRole('cell').map((c) => c.textContent)).toEqual(['—', '—', '—', '—']);
  });
});
