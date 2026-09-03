import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EstimateSectionGrid } from './EstimateFormFields';
import type { EstimateFormField } from '@/lib/estimateForm';

const DATE_FIELD: EstimateFormField = {
  key: 'estimate_date',
  label: 'Estimate Date',
  type: 'date',
  required: true,
};

describe('EstimateSectionGrid — date fields', () => {
  it('renders a DatePicker trigger (not a native date input) for a type: "date" field', () => {
    render(
      <EstimateSectionGrid
        fields={[DATE_FIELD]}
        data={{ estimate_date: '2026-08-19' }}
        set={vi.fn()}
      />,
    );

    // The DatePicker trigger is an accessible button showing the formatted
    // date — a native <input type="date"> would not expose a "button" role.
    const trigger = screen.getByRole('button', { name: 'Estimate Date' });
    expect(trigger).toHaveTextContent('Aug 19, 2026');
    expect(screen.queryByDisplayValue('2026-08-19')).not.toBeInTheDocument();
  });
});
