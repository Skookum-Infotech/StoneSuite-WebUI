import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReviewSplitLayout } from './ReviewSplitLayout';

const originalMatchMedia = window.matchMedia;

function mockViewport(width: number): void {
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = (min ? width >= Number(min[1]) : true) && (max ? width <= Number(max[1]) : true);
    return { matches, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  });
}

function renderLayout(): void {
  render(
    <ReviewSplitLayout pane={<p>document pane</p>} focusNonce={0}>
      <p>form</p>
    </ReviewSplitLayout>,
  );
}

describe('ReviewSplitLayout', () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it.each([
    { width: 1440, paneOpen: true },
    { width: 1024, paneOpen: false },
  ])('at $width px the document pane starts open=$paneOpen', ({ width, paneOpen }) => {
    mockViewport(width);
    renderLayout();
    expect(screen.queryByText('document pane') !== null).toBe(paneOpen);
    expect(screen.getByText('form')).toBeInTheDocument();
  });

  it('a collapsed pane can be opened with the toggle', async () => {
    mockViewport(1024);
    renderLayout();
    await userEvent.click(screen.getByRole('button', { name: 'Show document pane' }));
    expect(screen.getByText('document pane')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide document pane' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('below 768 px the pane is a bottom sheet behind a View document button', async () => {
    mockViewport(375);
    renderLayout();
    expect(screen.queryByText('document pane')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'View document' }));
    expect(screen.getByRole('dialog', { name: 'Source document' })).toBeInTheDocument();
  });
});
