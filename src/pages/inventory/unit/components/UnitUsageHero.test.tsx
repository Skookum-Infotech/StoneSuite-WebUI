import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { UnitUsageHero } from './UnitUsageHero';
import { makeCutUnit, makeUnit } from './unitFixtures';

describe('UnitUsageHero', () => {
  it('says an untouched slab is untouched and shows its size once', () => {
    render(<UnitUsageHero unit={makeUnit()} />);

    expect(screen.getByText('Untouched', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Untouched: 45.20 sq ft still whole.')).toBeInTheDocument();
    expect(screen.getByText('Slab size')).toBeInTheDocument();
    expect(screen.getByText('45.20 sq ft')).toBeInTheDocument();
    expect(screen.queryByText('Used')).not.toBeInTheDocument();
  });

  it('leads with how much of a cut slab is gone, then breaks it down', () => {
    render(<UnitUsageHero unit={makeCutUnit(30, 15.2, 2)} />);

    expect(screen.getByText('66% used')).toBeInTheDocument();
    const used = screen.getByText('Used').closest('div') as HTMLElement;
    expect(within(used).getByText('30.00 sq ft')).toBeInTheDocument();
    expect(within(used).getByText('Finished product and saw kerf')).toBeInTheDocument();
    const back = screen.getByText('Back as offcuts').closest('div') as HTMLElement;
    expect(within(back).getByText('15.20 sq ft')).toBeInTheDocument();
    expect(within(back).getByText('2 offcuts')).toBeInTheDocument();
    expect(screen.getByText('Size before cutting')).toBeInTheDocument();
  });

  it('calls a slab cut with nothing kept fully used', () => {
    render(<UnitUsageHero unit={makeCutUnit(45.2, 0, 0)} />);

    expect(screen.getByText('Fully used')).toBeInTheDocument();
    const back = screen.getByText('Back as offcuts').closest('div') as HTMLElement;
    expect(within(back).getByText('None')).toBeInTheDocument();
  });

  it('describes the bar for assistive tech', () => {
    render(<UnitUsageHero unit={makeCutUnit(30, 15.2, 2)} />);

    expect(screen.getByRole('img', {
      name: 'Cut: 30.00 sq ft used in product and saw kerf; 15.20 sq ft came back as 2 offcuts.',
    })).toBeInTheDocument();
  });
});
