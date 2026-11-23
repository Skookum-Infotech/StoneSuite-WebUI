import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('./UnitOffcutsList', () => ({
  UnitOffcutsList: ({ parentId }: { parentId: string }) => <div>offcuts of {parentId}</div>,
}));

import { UnitUsageTab } from './UnitUsageTab';
import { makeCutUnit, makeUnit } from './unitFixtures';

describe('UnitUsageTab', () => {
  it('leads with the usage, then the lifecycle', () => {
    render(<UnitUsageTab unit={makeUnit()} />);

    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['Usage', 'Lifecycle']);
  });

  it('lists the offcuts of a slab that gave some back', () => {
    render(<UnitUsageTab unit={makeCutUnit(30, 15.2, 2, { id: 'slab-9' })} />);

    expect(screen.getByRole('heading', { name: 'Offcuts' })).toBeInTheDocument();
    expect(screen.getByText('offcuts of slab-9')).toBeInTheDocument();
  });

  it('has no Offcuts section when a cut kept nothing', () => {
    render(<UnitUsageTab unit={makeCutUnit(45.2, 0, 0)} />);

    expect(screen.queryByRole('heading', { name: 'Offcuts' })).not.toBeInTheDocument();
  });

  it('has no Offcuts section for a slab that has not been cut', () => {
    render(<UnitUsageTab unit={makeUnit()} />);

    expect(screen.queryByRole('heading', { name: 'Offcuts' })).not.toBeInTheDocument();
  });
});
