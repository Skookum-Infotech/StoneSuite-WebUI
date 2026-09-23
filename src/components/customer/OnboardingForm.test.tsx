import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/tenantServices', () => ({
  onboardingService: { formSchema: vi.fn(), lookups: vi.fn() },
}));

import { OnboardingForm } from './OnboardingForm';
import { onboardingService } from '@/services/tenantServices';
import { DEFAULT_COUNTRY_NAME } from '@/lib/lookupDefaults';

function renderForm(prefill?: Record<string, unknown>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <OnboardingForm prefill={prefill} submitting={false} onSubmit={vi.fn()} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(onboardingService.formSchema).mockResolvedValue([]);
  vi.mocked(onboardingService.lookups).mockResolvedValue({ countries: [], currencies: [] });
});

describe('OnboardingForm — placeholders', () => {
  it('shows example placeholder text on plain text fields', () => {
    renderForm();

    expect(screen.getByPlaceholderText('e.g. Acme Stone Co.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. 12-3456789')).toBeInTheDocument();
  });

  it('shows a placeholder on every address section, not just Billing', () => {
    renderForm();

    expect(screen.getAllByPlaceholderText('e.g. 123 Main Street')).toHaveLength(3);
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
      currencies: [{ id: 1, code: 'USD', name: 'US Dollar' }],
    });
    renderForm();

    expect(await screen.findByRole('button', { name: 'Currency: USD — US Dollar' })).toBeInTheDocument();
  });
});
