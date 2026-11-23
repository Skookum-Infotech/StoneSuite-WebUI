import { describe, expect, it } from 'vitest';
import { connectorColor } from './workflowStagePalette';
import type { WorkflowStageView } from '@/lib/workflowStages';

const view = (state: WorkflowStageView['state'], ring?: string): WorkflowStageView => ({
  key: 'quote', label: 'x', state, subtitle: '', records: [], hidden: false, module: 'quote', route: '',
  complete: false, color: ring ? { tint: '#fff', ring, ink: '#000' } : undefined,
});

describe('connectorColor', () => {
  // quote(upcoming) / sales order(done) / fabrication(upcoming) / installation(upcoming) / invoice(here)
  const stages = [view('upcoming'), view('done', '#99c466'), view('upcoming'), view('upcoming'), view('here', '#3b82f6')];

  it.each([
    [0, undefined],       // nothing reached above it
    [1, '#99c466'],       // sales order down to the next stage
    [2, '#99c466'],       // passes through the skipped fabrication
    [3, '#99c466'],       // and installation, into the invoice
    [4, undefined],       // nothing reached below the invoice
  ])('line below stage %i', (idx, expected) => {
    expect(connectorColor(stages, idx)).toBe(expected);
  });
});
