import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));
vi.mock('@/hooks/useDocumentExtraction', () => ({ useDocumentExtraction: vi.fn() }));

import { CreateFromDocumentDialog } from './CreateFromDocumentDialog';
import { useDocumentExtraction, type UseDocumentExtraction } from '@/hooks/useDocumentExtraction';
import { initialExtractionState, type ExtractionState } from '@/lib/documentExtractionMachine';
import { toast } from 'sonner';
import type { DocumentExtraction } from '@/types/documentExtraction';
import { isDuplicateAcknowledged } from '@/lib/documentDuplicateAck';

const FILE = new File(['%PDF'], 'PO-4471.pdf', { type: 'application/pdf' });

const handlers = {
  start: vi.fn().mockResolvedValue(undefined),
  retry: vi.fn(),
  cancel: vi.fn(),
  continueInBackground: vi.fn().mockResolvedValue(true),
  reset: vi.fn(),
};

function mockHook(state: Partial<ExtractionState>, extra: Partial<UseDocumentExtraction> = {}) {
  vi.mocked(useDocumentExtraction).mockReturnValue({
    state: { ...initialExtractionState, fileName: FILE.name, extractionId: 'ex-1', ...state },
    extraction: undefined,
    canContinueInBackground: false,
    ...handlers,
    ...extra,
  });
}

function renderDialog() {
  const onClose = vi.fn();
  render(<CreateFromDocumentDialog file={FILE} onClose={onClose} />);
  return onClose;
}

beforeEach(() => {
  vi.clearAllMocks();
  handlers.start.mockResolvedValue(undefined);
  handlers.continueInBackground.mockResolvedValue(true);
});

describe('CreateFromDocumentDialog', () => {
  it('starts the flow with the file and shows an accessible dialog with the stepper', () => {
    mockHook({ stage: 'validating' });
    renderDialog();
    expect(handlers.start).toHaveBeenCalledWith(FILE);
    expect(screen.getByRole('dialog', { name: /create sales order from document/i })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /document progress/i })).toBeInTheDocument();
  });

  it('shows upload progress with a percentage and cancels', async () => {
    mockHook({ stage: 'uploading', progress: 37 });
    renderDialog();
    expect(screen.getByText('37%')).toBeInTheDocument();
    expect(screen.getByLabelText('Upload progress')).toHaveAttribute('value', '37');
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Upload');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel upload' }));
    expect(handlers.cancel).toHaveBeenCalled();
  });

  it('shows the interrupted state with auto-retry status', () => {
    mockHook({ stage: 'interrupted', attempt: 2 });
    renderDialog();
    expect(screen.getByText(/upload interrupted/i)).toBeInTheDocument();
    expect(screen.getByText(/attempt 2 of 3/i)).toBeInTheDocument();
  });

  it('shows elapsed time and hides Continue in background before 10 s', () => {
    mockHook({ stage: 'reading', elapsedSec: 4 });
    renderDialog();
    expect(screen.getByText(/4s/)).toBeInTheDocument();
    expect(screen.getByText(/under 30 s/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue in background' })).not.toBeInTheDocument();
  });

  it('continues in background: notifies, toasts the file name and closes', async () => {
    mockHook({ stage: 'reading', elapsedSec: 11 }, { canContinueInBackground: true });
    const onClose = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Continue in background' }));
    expect(handlers.continueInBackground).toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith("We'll notify you when PO-4471.pdf is ready");
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the dialog open and errors when the notify call fails', async () => {
    handlers.continueInBackground.mockResolvedValue(false);
    mockHook({ stage: 'reading', elapsedSec: 11 }, { canContinueInBackground: true });
    const onClose = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Continue in background' }));
    expect(toast.error).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('failed state shows the file name, the reason, Retry and Enter manually', async () => {
    mockHook({ stage: 'failed', failedAt: 'read', failure: { code: 'upload_corrupted', message: 'The file was damaged during upload.' } });
    const onClose = renderDialog();
    expect(screen.getByRole('alert')).toHaveTextContent('PO-4471.pdf');
    expect(screen.getByRole('alert')).toHaveTextContent('The file was damaged during upload.');
    await userEvent.click(screen.getByRole('button', { name: 'Retry with this document' }));
    expect(handlers.retry).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Enter manually' }));
    expect(onClose).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/sales/sales_order/new');
  });

  it('hides Retry for a failure the file itself caused', () => {
    mockHook({ stage: 'failed', failedAt: 'read', failure: { code: 'scanned', message: 'Scanned.' } });
    renderDialog();
    expect(screen.queryByRole('button', { name: 'Retry with this document' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enter manually' })).toBeInTheDocument();
  });

  it('navigates to the review form with the extraction id when ready', () => {
    mockHook({ stage: 'ready' });
    const onClose = renderDialog();
    expect(navigate).toHaveBeenCalledWith('/sales/sales_order/new?fromDocument=ex-1');
    expect(onClose).toHaveBeenCalled();
  });

  it('on ready with a duplicate, asks first: Open existing / Create anyway', async () => {
    const extraction = {
      result: { duplicates: [{ kind: 'same_po', recordUuid: 'so-9', number: 'SO-1042', status: 'Open', reason: 'A sales order with this PO number exists.' }] },
    } as unknown as DocumentExtraction;
    mockHook({ stage: 'ready' }, { extraction });
    renderDialog();
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByText(/A sales order with this PO number exists/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open existing SO-1042' }));
    expect(navigate).toHaveBeenCalledWith('/sales/sales_order/so-9');
    await userEvent.click(screen.getByRole('button', { name: 'Create anyway' }));
    expect(navigate).toHaveBeenCalledWith('/sales/sales_order/new?fromDocument=ex-1');
    expect(isDuplicateAcknowledged('ex-1', 'so-9')).toBe(true);
  });

  it('omits Open existing when the server did not reveal the record', () => {
    const extraction = {
      result: { duplicates: [{ kind: 'revision', reason: 'Looks like Revision 2.' }] },
    } as unknown as DocumentExtraction;
    mockHook({ stage: 'ready' }, { extraction });
    renderDialog();
    expect(screen.queryByRole('button', { name: /open existing/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create anyway' })).toBeInTheDocument();
  });

  it('Escape cancels a running upload', async () => {
    mockHook({ stage: 'uploading', progress: 5 });
    renderDialog();
    await userEvent.keyboard('{Escape}');
    expect(handlers.cancel).toHaveBeenCalled();
  });

  it('closes itself once cancelled', () => {
    mockHook({ stage: 'cancelled' });
    expect(renderDialog()).toHaveBeenCalled();
  });

  it.each([
    ['limit', /today's limit/i],
    ['aiDisabled', /turned off for your workspace/i],
    ['storageFull', /too many pending uploads/i],
  ] as const)('shows the %s message', (stage, text) => {
    mockHook({ stage });
    renderDialog();
    expect(screen.getByRole('alert')).toHaveTextContent(text);
  });
});
