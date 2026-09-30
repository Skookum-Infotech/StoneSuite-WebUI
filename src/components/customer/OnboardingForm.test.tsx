import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/tenantServices', () => ({
  onboardingService: { formSchema: vi.fn(), lookups: vi.fn() },
}));

import { OnboardingForm } from './OnboardingForm';
import { onboardingService } from '@/services/tenantServices';
import { DEFAULT_COUNTRY_NAME } from '@/lib/lookupDefaults';

const USA = 'United States of America';

const LOOKUPS = {
  countries: [
    { id: 1, code: 'US', name: USA },
    { id: 2, code: 'CA', name: 'Canada' },
  ],
  states: [
    { id: 1, code: 'IL', name: 'Illinois', countryId: 1 },
    { id: 2, code: 'TX', name: 'Texas', countryId: 1 },
    { id: 3, code: 'ON', name: 'Ontario', countryId: 2 },
  ],
  currencies: [{ id: 1, code: 'USD', name: 'US Dollar' }],
};

// Every required text input filled -- what's left blank are the dropdown
// fields, which the browser's own `required` validation can't see.
const TEXT_FIELDS_FILLED = {
  company_name: 'Acme Stone Co.',
  super_admin_email: 'owner@acmestone.example',
  location_name: 'Main Showroom',
  location_address_line1: '123 Main St',
  location_address_city: 'Springfield',
  location_address_zip: '62704',
};

function renderForm(prefill?: Record<string, unknown>, onSubmit: (data: Record<string, unknown>) => void = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <OnboardingForm prefill={prefill} submitting={false} onSubmit={onSubmit} />
    </QueryClientProvider>,
  );
}

// The card a section renders in, so a field that repeats across sections
// (Country, State / Province, Phone) can be addressed in just one of them.
function section(title: string) {
  const card = screen.getByRole('heading', { name: title }).closest('.rounded-2xl');
  if (!(card instanceof HTMLElement)) throw new Error(`no section card for "${title}"`);
  return within(card);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(onboardingService.formSchema).mockResolvedValue([]);
  vi.mocked(onboardingService.lookups).mockResolvedValue({ countries: [], states: [], currencies: [] });
});

describe('OnboardingForm — placeholders', () => {
  it('shows example placeholder text on plain text fields', () => {
    renderForm();

    expect(screen.getByPlaceholderText('e.g. Acme Stone Co.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. 12-3456789')).toBeInTheDocument();
  });

  it('shows a placeholder on every address section, not just Billing', () => {
    renderForm();

    // Primary Location + Billing + Shipping + Return.
    expect(screen.getAllByPlaceholderText('e.g. 123 Main Street')).toHaveLength(4);
  });
});

describe('OnboardingForm — Country dropdown', () => {
  it('defaults Country to the same wording the lookup table uses elsewhere in the app', () => {
    // Lookups haven't resolved (empty mock), so the picker treats the
    // static-fallback value the same way it treats any value absent from
    // its options: labeled "(current)" rather than silently dropped — see
    // OnboardingSelectField.test.tsx's "falls back to showing the raw
    // value" case.
    renderForm();

    expect(screen.getByRole('button', { name: `Country: ${DEFAULT_COUNTRY_NAME} (current)` })).toBeInTheDocument();
  });

  it('lets a saved draft override the default country', () => {
    renderForm({ country: 'Canada' });

    expect(screen.getByRole('button', { name: 'Country: Canada (current)' })).toBeInTheDocument();
  });

  it('prefers the live lookup table over the static fallback once it loads', async () => {
    vi.mocked(onboardingService.lookups).mockResolvedValue({
      countries: [{ id: 1, code: 'US', name: 'Not The Static Fallback' }],
      states: [],
      currencies: [],
    });
    renderForm();

    expect(await screen.findByRole('button', { name: 'Country: Not The Static Fallback' })).toBeInTheDocument();
  });
});

describe('OnboardingForm — Currency dropdown', () => {
  it('renders Currency as a dropdown defaulting to USD', async () => {
    vi.mocked(onboardingService.lookups).mockResolvedValue({
      countries: [],
      states: [],
      currencies: [{ id: 1, code: 'USD', name: 'US Dollar' }],
    });
    renderForm();

    expect(await screen.findByRole('button', { name: 'Currency: USD — US Dollar' })).toBeInTheDocument();
  });
});

describe('OnboardingForm — State dropdown', () => {
  beforeEach(() => {
    vi.mocked(onboardingService.lookups).mockResolvedValue(LOOKUPS);
  });

  it('renders State / Province as a dropdown in every address section, not a text box', () => {
    renderForm();

    for (const title of ['Primary Location', 'Billing Address', 'Shipping Address', 'Return Address']) {
      expect(section(title).getByRole('button', { name: 'State / Province: Select a state' })).toBeInTheDocument();
    }
    expect(screen.queryByPlaceholderText('e.g. Illinois')).not.toBeInTheDocument();
  });

  it("offers only the chosen country's states from the lookup table", async () => {
    const user = userEvent.setup();
    renderForm({ location_address_country: USA });
    const location = section('Primary Location');

    await user.click(location.getByRole('button', { name: 'State / Province: Select a state' }));

    expect(await screen.findByRole('option', { name: 'Illinois' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Texas' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Ontario' })).not.toBeInTheDocument();
  });

  it('keeps a chosen state until the country changes, then clears it', async () => {
    const user = userEvent.setup();
    renderForm({ location_address_country: USA, location_address_state: 'Illinois' });
    const location = section('Primary Location');
    expect(await location.findByRole('button', { name: 'State / Province: Illinois' })).toBeInTheDocument();

    await user.click(location.getByRole('button', { name: `Country: ${USA}` }));
    await user.click(await screen.findByRole('option', { name: 'Canada' }));

    expect(location.getByRole('button', { name: 'Country: Canada' })).toBeInTheDocument();
    expect(location.getByRole('button', { name: 'State / Province: Select a state' })).toBeInTheDocument();
  });

  it('leaves the state alone when the same country is picked again', async () => {
    const user = userEvent.setup();
    renderForm({ location_address_country: USA, location_address_state: 'Illinois' });
    const location = section('Primary Location');

    await user.click(await location.findByRole('button', { name: `Country: ${USA}` }));
    await user.click(await screen.findByRole('option', { name: USA }));

    expect(location.getByRole('button', { name: 'State / Province: Illinois' })).toBeInTheDocument();
  });
});

describe('OnboardingForm — Primary Location', () => {
  beforeEach(() => {
    vi.mocked(onboardingService.lookups).mockResolvedValue(LOOKUPS);
  });

  it('marks the name and address parts mandatory, but not the phone, line 2 or suite', () => {
    renderForm();
    const location = section('Primary Location');

    for (const label of ['Location Name', 'Address Line 1', 'City', 'Country', 'State / Province', 'Zip / Postal Code']) {
      expect(location.getByText(label).querySelector('.text-red-500'), `${label} should show *`).not.toBeNull();
    }
    for (const label of ['Phone', 'Address Line 2', 'Suite / Unit #']) {
      expect(location.getByText(label).querySelector('.text-red-500'), `${label} should not show *`).toBeNull();
    }
  });

  it('blocks submit and names the dropdown fields that are still empty', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderForm(TEXT_FIELDS_FILLED, onSubmit);

    await user.click(screen.getByRole('button', { name: /Submit application/ }));

    const banner = await screen.findByText(/Please fill in the required fields/);
    expect(banner).toHaveTextContent('Primary Location: Country');
    expect(banner).toHaveTextContent('Primary Location: State / Province');
    expect(banner).not.toHaveTextContent('Primary Location: City');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the location as flat location_* keys once everything required is filled', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderForm(
      { ...TEXT_FIELDS_FILLED, location_address_country: USA, location_address_state: 'Illinois' },
      onSubmit,
    );

    await user.click(screen.getByRole('button', { name: /Submit application/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      company_name: 'Acme Stone Co.',
      location_name: 'Main Showroom',
      location_address_line1: '123 Main St',
      location_address_city: 'Springfield',
      location_address_country: USA,
      location_address_state: 'Illinois',
      location_address_zip: '62704',
    });
  });
});
