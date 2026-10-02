import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocumentPane } from './DocumentPane';
import type { ExtractedPageRows } from '@/types/documentExtraction';

const pages: ExtractedPageRows[] = [
  { page: 1, rows: [
    { y: 700, words: [{ x: 0, w: 1, text: 'ACME' }, { x: 2, w: 1, text: 'Stone' }] },
    { y: 680, words: [{ x: 0, w: 1, text: 'PO-4471' }] },
  ] },
  { page: 2, rows: [{ y: 700, words: [{ x: 0, w: 1, text: 'Total' }, { x: 2, w: 1, text: '500.00' }] }] },
];
const pdf = new File(['%PDF'], 'po.pdf', { type: 'application/pdf' });

function mockReducedMotion(reduced: boolean): void {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
}

beforeEach(() => {
  mockReducedMotion(false);
  Element.prototype.scrollIntoView = vi.fn();
  URL.createObjectURL = vi.fn(() => 'blob:po');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

describe('DocumentPane', () => {
  it('falls back to the Text view only when the file is missing', () => {
    render(<DocumentPane file={undefined} fileName="po.pdf" pages={pages} focus={null} />);
    expect(screen.queryByRole('tab', { name: 'Original' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Text view', selected: true })).toBeInTheDocument();
    expect(screen.getByText('ACME Stone')).toBeInTheDocument();
    expect(screen.getByText(/original file isn't available/)).toBeInTheDocument();
  });

  it('shows Text view only for a DOCX', () => {
    const docx = new File(['x'], 'po.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    render(<DocumentPane file={docx} fileName="po.docx" pages={pages} focus={null} />);
    expect(screen.queryByRole('tab', { name: 'Original' })).not.toBeInTheDocument();
  });

  it('shows the PDF at the focused page and revokes the blob URL on unmount', async () => {
    const { container, unmount } = render(<DocumentPane file={pdf} fileName="po.pdf" pages={pages} focus={{ page: 2, nonce: 1 }} />);
    const obj = await vi.waitFor(() => {
      const el = container.querySelector('object');
      if (!el) throw new Error('no object yet');
      return el;
    });
    expect(obj.getAttribute('data')).toBe('blob:po#page=2');
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:po');
  });

  it('highlights and scrolls to the row behind the focused field in Text view', async () => {
    render(<DocumentPane file={undefined} fileName="po.pdf" pages={pages} focus={{ page: 1, row: 2, nonce: 0 }} />);
    const row = screen.getByText('PO-4471');
    expect(row).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText('ACME Stone')).not.toHaveAttribute('aria-current');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
  });

  it('does not animate the scroll under prefers-reduced-motion', () => {
    mockReducedMotion(true);
    render(<DocumentPane file={undefined} fileName="po.pdf" pages={pages} focus={{ page: 1, row: 2, nonce: 0 }} />);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'auto' });
  });

  it('switches between tabs', async () => {
    render(<DocumentPane file={pdf} fileName="po.pdf" pages={pages} focus={null} />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Text view' }));
    expect(screen.getByText('ACME Stone')).toBeInTheDocument();
  });

  it('wires tabs to the panel and supports roving arrow / Home / End keys', async () => {
    render(<DocumentPane file={pdf} fileName="po.pdf" pages={pages} focus={null} />);
    const original = await screen.findByRole('tab', { name: 'Original' });
    const text = screen.getByRole('tab', { name: 'Text view' });
    expect(original).toHaveAttribute('tabindex', '0');
    expect(text).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', original.id);
    expect(original).toHaveAttribute('aria-controls', screen.getByRole('tabpanel').id);
    original.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(text).toHaveFocus();
    expect(text).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', text.id);
    await userEvent.keyboard('{Home}');
    expect(original).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(text).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(original).toHaveFocus();
  });
});
