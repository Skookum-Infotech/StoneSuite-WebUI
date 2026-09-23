import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingSelectField } from './OnboardingSelectField';

const OPTIONS = [
  { value: 'United States of America', label: 'United States of America' },
  { value: 'Canada', label: 'Canada' },
];

describe('OnboardingSelectField', () => {
  it('shows the placeholder on the trigger when nothing is selected', () => {
    render(<OnboardingSelectField label="Country" value="" onChange={vi.fn()} options={OPTIONS} placeholder="Select a country" />);

    expect(screen.getByRole('button', { name: 'Country: Select a country' })).toBeInTheDocument();
  });

  it("shows the selected option's label on the trigger", () => {
    render(<OnboardingSelectField label="Country" value="Canada" onChange={vi.fn()} options={OPTIONS} placeholder="Select a country" />);

    expect(screen.getByRole('button', { name: 'Country: Canada' })).toBeInTheDocument();
  });

  it('lists every option once opened, and narrows the list as you search', async () => {
    const user = userEvent.setup();
    render(<OnboardingSelectField label="Country" value="" onChange={vi.fn()} options={OPTIONS} placeholder="Select a country" />);

    await user.click(screen.getByRole('button', { name: 'Country: Select a country' }));
    expect(await screen.findByRole('option', { name: 'United States of America' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Canada' })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Search…'), 'can');
    expect(screen.queryByRole('option', { name: 'United States of America' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Canada' })).toBeInTheDocument();
  });

  it('picking an option reports it and closes the list', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<OnboardingSelectField label="Country" value="" onChange={onChange} options={OPTIONS} placeholder="Select a country" />);

    await user.click(screen.getByRole('button', { name: 'Country: Select a country' }));
    await user.click(await screen.findByRole('option', { name: 'Canada' }));

    expect(onChange).toHaveBeenCalledWith('Canada');
    expect(screen.queryByRole('option', { name: 'Canada' })).not.toBeInTheDocument();
  });

  it('falls back to showing the raw value when it matches no option in the list', () => {
    // options is expected to already include the current value (via
    // lib/companyInfoLookupOptions.ts's withCurrentValue) by the time a real
    // caller renders this -- this only covers the component's own fallback
    // so an unmatched value never silently disappears from the trigger.
    render(<OnboardingSelectField label="Country" value="USA" onChange={vi.fn()} options={OPTIONS} placeholder="Select a country" />);

    expect(screen.getByRole('button', { name: 'Country: USA' })).toBeInTheDocument();
  });
});
