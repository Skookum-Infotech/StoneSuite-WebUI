import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

import { UnitDetailsTab } from './UnitDetailsTab';
import { makeUnit } from './unitFixtures';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UnitDetailsTab', () => {
  it('lists what the unit is, with its area in its own unit', () => {
    render(<UnitDetailsTab unit={makeUnit({ lot: 'LOT-9', grade: 'A' })} />);

    expect(screen.getByRole('heading', { name: 'Unit Information' })).toBeInTheDocument();
    expect(screen.getByText('Absolute Black')).toBeInTheDocument();
    expect(screen.getByText('45.20 sq ft')).toBeInTheDocument();
    expect(screen.getByText('3000 × 1400 × 30')).toBeInTheDocument();
    expect(screen.getByText('LOT-9')).toBeInTheDocument();
  });

  it('has no Lineage for a slab that was received whole', () => {
    render(<UnitDetailsTab unit={makeUnit()} />);

    expect(screen.queryByRole('heading', { name: 'Lineage' })).not.toBeInTheDocument();
  });

  it('names the slab an offcut was cut from, never its id', async () => {
    render(<UnitDetailsTab unit={makeUnit({
      kind: 'remnant', form: 'cut', parentUnitId: 'uuid-parent', parentSerial: 'PO-00012-001',
      rootUnitId: 'uuid-parent', rootSerial: 'PO-00012-001',
    })} />);

    const parent = screen.getByRole('button', { name: 'Open parent unit PO-00012-001' });
    expect(parent).toHaveTextContent('PO-00012-001');
    expect(screen.queryByText(/uuid-parent/)).not.toBeInTheDocument();
    // The parent IS the original slab, so it is not listed twice.
    expect(screen.queryByText('Original Slab')).not.toBeInTheDocument();
    await userEvent.setup().click(parent);
    expect(navigate).toHaveBeenCalledWith('/inventory/unit/uuid-parent');
  });

  it('also names the original slab when the offcut was cut from another offcut', () => {
    render(<UnitDetailsTab unit={makeUnit({
      kind: 'remnant', form: 'cut',
      parentUnitId: 'uuid-offcut', parentSerial: 'PO-00012-001-R1',
      rootUnitId: 'uuid-slab', rootSerial: 'PO-00012-001',
    })} />);

    expect(screen.getByRole('button', { name: 'Open parent unit PO-00012-001-R1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open original slab PO-00012-001' })).toBeInTheDocument();
  });
});
