import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

import { UnitLifecycle } from './UnitLifecycle';
import { makeCutUnit, makeUnit } from './unitFixtures';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UnitLifecycle', () => {
  it('tells an untouched slab\'s story: received, then in stock where it sits', () => {
    render(<UnitLifecycle unit={makeUnit({ receiptId: 'ir-1', receiptNumber: 'IR-000123', binPath: 'Yard / A1' })} />);

    const steps = within(screen.getByRole('list', { name: 'Lifecycle' })).getAllByRole('listitem');
    expect(steps).toHaveLength(2);
    expect(steps[0]).toHaveTextContent('Received on IR-000123');
    expect(steps[1]).toHaveTextContent('In stock');
    expect(steps[1]).toHaveTextContent('Main Yard · Yard / A1');
  });

  it('marks only where the unit is now as the current step', () => {
    render(<UnitLifecycle unit={makeUnit()} />);

    const steps = screen.getAllByRole('listitem');
    expect(steps[0]).not.toHaveAttribute('aria-current');
    expect(steps[1]).toHaveAttribute('aria-current', 'step');
  });

  it('shows the job that held a slab and what the cut did to it', () => {
    const unit = makeCutUnit(30, 15.2, 2, {
      usage: {
        jobId: 'job-7', jobNumber: 'FJOB-000007',
        reservedAt: '2026-09-28T09:00:00', consumedAt: '2026-09-29T10:30:00',
        usedArea: 30, recoveredArea: 15.2, offcutCount: 2,
      },
    });
    render(<UnitLifecycle unit={unit} />);

    const steps = screen.getAllByRole('listitem');
    expect(steps.map((s) => s.querySelector('p')?.textContent)).toEqual([
      'Added to inventory', 'Held for job FJOB-000007', 'Cut',
    ]);
    expect(steps[2]).toHaveTextContent('30.00 sq ft used · 15.20 sq ft came back as 2 offcuts');
    expect(steps[2]).toHaveAttribute('aria-current', 'step');
  });

  it('shows when each step happened', () => {
    render(<UnitLifecycle unit={makeCutUnit(30, 15.2, 2)} />);

    const cut = screen.getAllByRole('listitem')[1];
    expect(cut).toHaveTextContent(new Date('2026-09-29T10:30:00').toLocaleString());
  });

  it('opens the receipt, the job, or the parent slab from its step', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<UnitLifecycle unit={makeUnit({ receiptId: 'ir-1', receiptNumber: 'IR-000123' })} />);
    await user.click(screen.getByRole('button', { name: 'Open IR-000123' }));
    expect(navigate).toHaveBeenLastCalledWith('/purchases/item_receipt/ir-1');

    rerender(<UnitLifecycle unit={makeUnit({ status: 'reserved', usage: { jobId: 'job-7', jobNumber: 'FJOB-000007', offcutCount: 0, recoveredArea: 0, usedArea: 0 } })} />);
    await user.click(screen.getByRole('button', { name: 'Open FJOB-000007' }));
    expect(navigate).toHaveBeenLastCalledWith('/sales/installation/job-7');

    rerender(<UnitLifecycle unit={makeUnit({ kind: 'remnant', form: 'cut', parentUnitId: 'p-1', parentSerial: 'PO-00012-001' })} />);
    await user.click(screen.getByRole('button', { name: 'Open PO-00012-001' }));
    expect(navigate).toHaveBeenLastCalledWith('/inventory/unit/p-1');
  });
});
