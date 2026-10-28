import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import RouteErrorPage from './RouteErrorPage';

function Boom(): never {
  throw new Error('kaboom');
}

function renderRoutes(routes: Parameters<typeof createMemoryRouter>[0], initial: string) {
  const router = createMemoryRouter(routes, { initialEntries: [initial] });
  return render(<RouterProvider router={router} />);
}

describe('RouteErrorPage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('replaces the developer error screen when a route throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderRoutes([{ path: '/', element: <Boom />, errorElement: <RouteErrorPage /> }], '/');

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Something went wrong on this page' })).toBeInTheDocument();
    expect(screen.getByText(/^Ref:/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload this page' })).toBeInTheDocument();
    expect(screen.queryByText(/kaboom/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to dashboard' })).toHaveAttribute('href', '/dashboard');
  });

  it('shows a friendly not-found screen for the catch-all route', () => {
    renderRoutes([{ path: '*', element: <RouteErrorPage notFound /> }], '/does-not-exist');

    expect(screen.getByRole('heading', { name: "We couldn't find that page" })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reload this page' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to dashboard' })).toBeInTheDocument();
  });

  it('omits the logo when embedded in the app shell', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderRoutes([{ path: '/', element: <Boom />, errorElement: <RouteErrorPage embedded /> }], '/');

    expect(screen.queryByAltText('Stone Suite logo')).not.toBeInTheDocument();
  });
});
