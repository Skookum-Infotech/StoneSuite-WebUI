import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('./components/UnitTable', () => ({ UnitTable: () => <div>unit table</div> }));
vi.mock('./components/RemnantsFinder', () => ({ RemnantsFinder: () => <div>remnants finder</div> }));

import UnitListPage from './UnitListPage';

function renderPage() {
  return render(<MemoryRouter><UnitListPage /></MemoryRouter>);
}

describe('UnitListPage', () => {
  it('is titled Inventory', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Inventory' })).toBeInTheDocument();
  });

  it('has no way to add a slab — slabs arrive by receiving a purchase order', () => {
    renderPage();

    expect(screen.queryByRole('button', { name: /receive slab/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new|add/i })).not.toBeInTheDocument();
    expect(screen.getByText(/added by receiving a purchase order/i)).toBeInTheDocument();
  });

  it('lists every unit by default and switches to the remnant finder', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByText('unit table')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Find Remnants' }));

    expect(screen.getByText('remnants finder')).toBeInTheDocument();
    expect(screen.queryByText('unit table')).not.toBeInTheDocument();
  });
});
