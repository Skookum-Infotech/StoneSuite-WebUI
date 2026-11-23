import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UnitConsumptionCell } from './UnitConsumptionCell';
import { makeCutUnit, makeUnit } from './unitFixtures';

describe('UnitConsumptionCell', () => {
  it('says an untouched slab is untouched, with a full in-stock bar', () => {
    render(<UnitConsumptionCell unit={makeUnit()} />);

    expect(screen.getByText('Untouched')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Untouched: 45.20 sq ft still whole.' })).toBeInTheDocument();
  });

  it('shows how much of a cut slab was used and how much came back', () => {
    render(<UnitConsumptionCell unit={makeCutUnit(30, 15.2, 2)} />);

    expect(screen.getByText('66% used · 15.20 sq ft back')).toBeInTheDocument();
    expect(screen.getByRole('img', {
      name: 'Cut: 30.00 sq ft used in product and saw kerf; 15.20 sq ft came back as 2 offcuts.',
    })).toBeInTheDocument();
  });

  it('says so when a slab was cut and nothing came back', () => {
    render(<UnitConsumptionCell unit={makeCutUnit(45.2, 0, 0)} />);

    expect(screen.getByText('Fully used')).toBeInTheDocument();
  });

  it('names the job a reserved slab is held for', () => {
    render(<UnitConsumptionCell unit={makeUnit({ status: 'reserved', usage: { jobNumber: 'FJOB-000012', offcutCount: 0, recoveredArea: 0, usedArea: 0 } })} />);

    expect(screen.getByText('Held for FJOB-000012')).toBeInTheDocument();
  });

  it('names the slab an offcut came from', () => {
    render(<UnitConsumptionCell unit={makeUnit({ kind: 'remnant', form: 'cut', parentSerial: 'PO-00012-001' })} />);

    expect(screen.getByText('Offcut of PO-00012-001')).toBeInTheDocument();
  });

  it('copes with a unit that carries no usage at all', () => {
    render(<UnitConsumptionCell unit={makeUnit({ usage: undefined, status: 'consumed' })} />);

    expect(screen.getByText('Fully used')).toBeInTheDocument();
  });
});
