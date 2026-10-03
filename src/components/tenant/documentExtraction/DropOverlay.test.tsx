import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), info: vi.fn() } }));

import { DropOverlay } from './DropOverlay';
import { toast } from 'sonner';

const pdf = new File(['%PDF'], 'po.pdf', { type: 'application/pdf' });

function drag(type: string, files: File[] = []) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { types: ['Files'], files } });
  act(() => { window.dispatchEvent(event); });
}

beforeEach(() => vi.clearAllMocks());

describe('DropOverlay', () => {
  it('shows the prompt while a file is dragged over and hides it on leave', () => {
    render(<DropOverlay documentLabel="Sales Order" onFileDropped={vi.fn()} />);
    expect(screen.queryByTestId('document-drop-overlay')).not.toBeInTheDocument();
    drag('dragenter');
    expect(screen.getByText('Drop a customer PO to create a Sales Order')).toBeInTheDocument();
    drag('dragleave');
    expect(screen.queryByTestId('document-drop-overlay')).not.toBeInTheDocument();
  });

  it('passes a valid dropped file on', () => {
    const onFileDropped = vi.fn();
    render(<DropOverlay documentLabel="Sales Order" onFileDropped={onFileDropped} />);
    drag('dragenter');
    drag('drop', [pdf]);
    expect(onFileDropped).toHaveBeenCalledWith(pdf);
  });

  it('rejects an unsupported file with a toast', () => {
    const onFileDropped = vi.fn();
    render(<DropOverlay documentLabel="Sales Order" onFileDropped={onFileDropped} />);
    drag('drop', [new File(['a,b'], 'sheet.csv', { type: 'text/csv' })]);
    expect(onFileDropped).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('swallows a blocked drop (no navigation) and says why', () => {
    const onFileDropped = vi.fn();
    render(<DropOverlay blockedReason="AI is off" documentLabel="Sales Order" onFileDropped={onFileDropped} />);
    fireEvent.dragEnter(window);
    expect(screen.queryByTestId('document-drop-overlay')).not.toBeInTheDocument();
    const event = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: { types: ['Files'], files: [pdf] } });
    act(() => { window.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(true);
    expect(onFileDropped).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('AI is off');
  });

  it('swallows silently when blocked without a message', () => {
    render(<DropOverlay blockedReason="" documentLabel="Sales Order" onFileDropped={vi.fn()} />);
    drag('drop', [pdf]);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('uses the first of several dropped files and says so', () => {
    const onFileDropped = vi.fn();
    render(<DropOverlay documentLabel="Sales Order" onFileDropped={onFileDropped} />);
    drag('drop', [pdf, new File(['%PDF'], 'second.pdf', { type: 'application/pdf' })]);
    expect(onFileDropped).toHaveBeenCalledWith(pdf);
    expect(toast.info).toHaveBeenCalledWith('Only po.pdf was used — drop one document at a time.');
  });
});
