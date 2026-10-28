import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { CopySeedGate } from './CopySeedGate';

function renderGate(url: string, load: (id: string) => Promise<{ name: string }>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <CopySeedGate queryKey="widget" load={load}>
          {(source) => <p data-testid="form">{source ? `copy of ${source.name}` : 'blank form'}</p>}
        </CopySeedGate>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CopySeedGate', () => {
  it('renders the blank form straight away, without loading, when no record is named', () => {
    const load = vi.fn();
    renderGate('/widgets/new', load);
    expect(screen.getByTestId('form')).toHaveTextContent('blank form');
    expect(load).not.toHaveBeenCalled();
  });

  it('loads the named record and hands it to the form', async () => {
    const load = vi.fn().mockResolvedValue({ name: 'Slab' });
    renderGate('/widgets/new?copyFrom=w-1', load);
    expect(await screen.findByTestId('form')).toHaveTextContent('copy of Slab');
    expect(load).toHaveBeenCalledWith('w-1');
  });

  it('refuses an id that is not shaped like one, without calling the API', async () => {
    const load = vi.fn();
    renderGate('/widgets/new?copyFrom=..%2Fquotes', load);
    expect(await screen.findByRole('alert')).toHaveTextContent("couldn't be loaded to copy");
    expect(load).not.toHaveBeenCalled();
  });

  it('shows one generic message when the record cannot be loaded', async () => {
    const load = vi.fn().mockRejectedValue(new Error('404 not found'));
    renderGate('/widgets/new?copyFrom=w-1', load);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("couldn't be loaded to copy");
    expect(alert).not.toHaveTextContent('404');
    expect(screen.queryByTestId('form')).not.toBeInTheDocument();
  });
});
