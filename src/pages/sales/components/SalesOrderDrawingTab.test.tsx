import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { Drawing } from '@/types/drawing';
import type { Attachment } from '@/services/attachmentService';
import type { DxfScene } from '@/lib/drawing/dxfSceneTypes';
import { DxfTooComplexError, DxfUnreadableError } from '@/lib/drawing/dxfSceneTypes';

vi.mock('@/services/drawingService', () => ({
  drawingService: { getDrawing: vi.fn() },
}));
vi.mock('@/services/attachmentService', () => ({
  attachmentService: {
    listAttachments: vi.fn(),
    uploadFiles: vi.fn(),
    fetchAttachmentBytes: vi.fn(),
    downloadAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
  },
}));
vi.mock('@/lib/drawing/dxfParseClient', () => ({ parseDxfScene: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from 'sonner';
import { drawingService } from '@/services/drawingService';
import { attachmentService } from '@/services/attachmentService';
import { parseDxfScene } from '@/lib/drawing/dxfParseClient';
import { SalesOrderDrawingTab } from './SalesOrderDrawingTab';

function drawing(): Drawing {
  return {
    schemaVersion: 1, salesOrderId: 'so-1', version: 1, displayUnit: 'in', fractionDenominator: 32,
    areas: [{ id: 'a1', name: 'Kitchen', code: '', sortOrder: 0, pieces: [], cabinets: [], notes: [] }],
    updatedAt: '2026-11-03T00:00:00.000Z', updatedBy: { id: 'u1', name: 'Test User' },
  };
}

function attachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: 'att-1', recordId: 'so-1', fileName: 'Kitchen.dxf', contentType: 'application/dxf', sizeBytes: 1024,
    storageKey: 'k', checksumSha256: '', status: 'clean', uploadedByUserId: 'u1', createdAt: '2026-11-01T00:00:00Z',
    ...overrides,
  };
}

function scene(text = 'Kitchen note', unsupported: Record<string, number> = {}): DxfScene {
  return {
    paths: [{ d: 'M0 0L10 10', dashed: false, filled: false }],
    texts: [{ text, x: 1, y: 1, height: 1, rotationDeg: 0, anchor: 'start', baseline: 'auto' }],
    bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
    unsupported,
  };
}

function renderTab(canEdit: boolean) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { container } = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SalesOrderDrawingTab orderId="so-1" canEdit={canEdit} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { container };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(drawingService.getDrawing).mockResolvedValue(null);
  vi.mocked(attachmentService.listAttachments).mockResolvedValue([]);
  vi.mocked(attachmentService.fetchAttachmentBytes).mockResolvedValue(new ArrayBuffer(8));
  vi.mocked(parseDxfScene).mockResolvedValue(scene());
});

describe('SalesOrderDrawingTab with nothing yet', () => {
  it('offers Upload and Draw to a user who can edit', async () => {
    renderTab(true);
    expect(await screen.findByText(/no drawing yet/i)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Draw' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Upload DXF' })).toBeDefined();
  });

  it('offers neither to a user without sales_order:update', async () => {
    renderTab(false);
    expect(await screen.findByText(/no drawing yet/i)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Draw' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Upload DXF' })).toBeNull();
  });

  it('ignores files on the order that are not DXFs', async () => {
    vi.mocked(attachmentService.listAttachments).mockResolvedValue([attachment({ fileName: 'quote.pdf', contentType: 'application/pdf' })]);
    renderTab(true);
    expect(await screen.findByText(/no drawing yet/i)).toBeDefined();
    expect(screen.queryByRole('tab', { name: 'quote.pdf' })).toBeNull();
  });
});

describe('SalesOrderDrawingTab with uploaded DXFs', () => {
  it('shows an uploaded file straight away, read-only', async () => {
    vi.mocked(attachmentService.listAttachments).mockResolvedValue([attachment()]);
    renderTab(false);

    expect(await screen.findByRole('img', { name: 'Kitchen.dxf' })).toBeDefined();
    expect(await screen.findByText('Kitchen note')).toBeDefined();
    expect(attachmentService.fetchAttachmentBytes).toHaveBeenCalledWith('so-1', 'att-1', expect.anything());
    expect(screen.queryByRole('button', { name: 'Upload DXF' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete/ })).toBeNull();
  });

  it('gives each file its own sub-tab, oldest first, and switches between them', async () => {
    vi.mocked(attachmentService.listAttachments).mockResolvedValue([
      attachment({ id: 'att-2', fileName: 'Master.dxf', createdAt: '2026-11-02T00:00:00Z' }),
      attachment({ id: 'att-1', fileName: 'Kitchen.dxf', createdAt: '2026-11-01T00:00:00Z' }),
    ]);
    vi.mocked(parseDxfScene).mockImplementation(async () =>
      scene(vi.mocked(attachmentService.fetchAttachmentBytes).mock.lastCall?.[1] === 'att-2' ? 'Master note' : 'Kitchen note'));
    renderTab(false);

    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Kitchen.dxf', 'Master.dxf']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(await screen.findByText('Kitchen note')).toBeDefined();

    await userEvent.click(tabs[1]);

    expect(await screen.findByText('Master note')).toBeDefined();
    expect(screen.queryByText('Kitchen note')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Master.dxf' }).getAttribute('aria-selected')).toBe('true');
  });

  it('tells two uploads of one name apart', async () => {
    vi.mocked(attachmentService.listAttachments).mockResolvedValue([
      attachment({ id: 'att-1', createdAt: '2026-11-01T00:00:00Z' }),
      attachment({ id: 'att-2', createdAt: '2026-11-02T00:00:00Z' }),
    ]);
    renderTab(false);

    expect(await screen.findByRole('tab', { name: 'Kitchen.dxf' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Kitchen.dxf (2)' })).toBeDefined();
  });

  it('also lists a drawing made in the editor, after the files', async () => {
    vi.mocked(attachmentService.listAttachments).mockResolvedValue([attachment()]);
    vi.mocked(drawingService.getDrawing).mockResolvedValue(drawing());
    renderTab(false);

    await userEvent.click(await screen.findByRole('tab', { name: 'Drawn' }));
    expect(await screen.findByText('Kitchen')).toBeDefined();
    expect(screen.queryByRole('img', { name: 'Kitchen.dxf' })).toBeNull();
  });

  it('opens on the editor drawing when there are no files', async () => {
    vi.mocked(drawingService.getDrawing).mockResolvedValue(drawing());
    renderTab(true);
    expect(await screen.findByText('Kitchen')).toBeDefined();
    expect(screen.queryByText(/no drawing yet/i)).toBeNull();
  });

  it('still shows files when the editor drawing fails to load', async () => {
    vi.mocked(attachmentService.listAttachments).mockResolvedValue([attachment()]);
    vi.mocked(drawingService.getDrawing).mockRejectedValue(new Error('boom'));
    renderTab(false);
    expect(await screen.findByRole('img', { name: 'Kitchen.dxf' })).toBeDefined();
  });

  it('says what it could not draw', async () => {
    vi.mocked(attachmentService.listAttachments).mockResolvedValue([attachment()]);
    vi.mocked(parseDxfScene).mockResolvedValue(scene('x', { SPLINE: 2, HATCH: 1 }));
    renderTab(false);
    expect(await screen.findByText(/2 SPLINE, 1 HATCH/)).toBeDefined();
  });
});

describe('SalesOrderDrawingTab when a file will not open', () => {
  async function expectDownloadStillOffered() {
    expect(await screen.findByRole('button', { name: /Download Kitchen.dxf/ })).toBeDefined();
  }

  it('explains an unreadable file and still offers the download', async () => {
    vi.mocked(attachmentService.listAttachments).mockResolvedValue([attachment()]);
    vi.mocked(parseDxfScene).mockRejectedValue(new DxfUnreadableError());
    renderTab(false);
    expect(await screen.findByText(/couldn't read this file/i)).toBeDefined();
    await expectDownloadStillOffered();
  });

  it('explains a drawing too complex to preview', async () => {
    vi.mocked(attachmentService.listAttachments).mockResolvedValue([attachment()]);
    vi.mocked(parseDxfScene).mockRejectedValue(new DxfTooComplexError());
    renderTab(false);
    expect(await screen.findByText(/too large to preview/i)).toBeDefined();
    await expectDownloadStillOffered();
  });

  it('does not even fetch a file over the preview limit', async () => {
    vi.mocked(attachmentService.listAttachments).mockResolvedValue([attachment({ sizeBytes: 11 * 1024 * 1024 })]);
    renderTab(false);
    expect(await screen.findByText(/too large to preview/i)).toBeDefined();
    expect(attachmentService.fetchAttachmentBytes).not.toHaveBeenCalled();
    await expectDownloadStillOffered();
  });

  it('offers a retry when the file could not be fetched, which is not the file\'s fault', async () => {
    vi.mocked(attachmentService.listAttachments).mockResolvedValue([attachment()]);
    vi.mocked(attachmentService.fetchAttachmentBytes).mockRejectedValueOnce(new Error('network'));
    renderTab(false);

    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Kitchen note')).toBeDefined();
  });

  it('says so when a file has nothing to draw', async () => {
    vi.mocked(attachmentService.listAttachments).mockResolvedValue([attachment()]);
    vi.mocked(parseDxfScene).mockResolvedValue({ paths: [], texts: [], bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 }, unsupported: {} });
    renderTab(false);
    expect(await screen.findByText(/nothing to show/i)).toBeDefined();
  });

  it('still says what is missing when nothing else could be drawn', async () => {
    vi.mocked(attachmentService.listAttachments).mockResolvedValue([attachment()]);
    vi.mocked(parseDxfScene).mockResolvedValue({ paths: [], texts: [], bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 }, unsupported: { ELLIPSE: 1 } });
    renderTab(false);
    expect(await screen.findByText(/1 ELLIPSE/)).toBeDefined();
  });

  it.each([
    ['pending', /scanning/i],
    ['infected', /can't be opened/i],
    ['failed', /can't be opened/i],
  ] as const)('never opens a file whose scan status is %s', async (status, message) => {
    vi.mocked(attachmentService.listAttachments).mockResolvedValue([attachment({ status })]);
    renderTab(false);
    expect(await screen.findByText(message)).toBeDefined();
    expect(attachmentService.fetchAttachmentBytes).not.toHaveBeenCalled();
  });
});

describe('SalesOrderDrawingTab uploading', () => {
  const dxfFile = (name = 'Kitchen.dxf') => new File(['0\nEOF'], name, { type: '' });

  function fileInput(container: HTMLElement) {
    return container.querySelector('input[type="file"]') as HTMLInputElement;
  }

  it('uploads the chosen files with the canonical type, then opens the new one', async () => {
    const uploaded = attachment();
    vi.mocked(attachmentService.uploadFiles).mockResolvedValue({ uploaded: [uploaded], failed: [] });
    const { container } = renderTab(true);
    await screen.findByText(/no drawing yet/i);
    vi.mocked(attachmentService.listAttachments).mockResolvedValue([uploaded]);

    await userEvent.upload(fileInput(container), dxfFile());

    await waitFor(() => expect(attachmentService.uploadFiles).toHaveBeenCalled());
    expect(vi.mocked(attachmentService.uploadFiles).mock.calls[0][1][0].type).toBe('application/dxf');
    expect(await screen.findByRole('img', { name: 'Kitchen.dxf' })).toBeDefined();
    expect(toast.success).toHaveBeenCalled();
  });

  it('accepts several files at once', async () => {
    vi.mocked(attachmentService.uploadFiles).mockResolvedValue({ uploaded: [attachment()], failed: [] });
    const { container } = renderTab(true);
    await screen.findByText(/no drawing yet/i);

    expect(fileInput(container).multiple).toBe(true);
    await userEvent.upload(fileInput(container), [dxfFile('A.dxf'), dxfFile('B.dxf')]);

    await waitFor(() => expect(attachmentService.uploadFiles).toHaveBeenCalled());
    expect(vi.mocked(attachmentService.uploadFiles).mock.calls[0][1].map((f) => f.name)).toEqual(['A.dxf', 'B.dxf']);
  });

  it('refuses a file that is not a DXF, without sending it', async () => {
    const { container } = renderTab(true);
    await screen.findByText(/no drawing yet/i);

    await userEvent.upload(fileInput(container), new File(['x'], 'photo.png', { type: 'image/png' }), { applyAccept: false });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('photo.png')));
    expect(attachmentService.uploadFiles).not.toHaveBeenCalled();
  });

  it('refuses a file over the upload limit, without sending it', async () => {
    const { container } = renderTab(true);
    await screen.findByText(/no drawing yet/i);
    const big = dxfFile('Huge.dxf');
    Object.defineProperty(big, 'size', { value: 26 * 1024 * 1024 });

    await userEvent.upload(fileInput(container), big);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Huge.dxf')));
    expect(attachmentService.uploadFiles).not.toHaveBeenCalled();
  });

  it('names a file that failed, alongside the ones that worked', async () => {
    vi.mocked(attachmentService.uploadFiles).mockResolvedValue({ uploaded: [attachment()], failed: ['Bad.dxf'] });
    const { container } = renderTab(true);
    await screen.findByText(/no drawing yet/i);

    await userEvent.upload(fileInput(container), [dxfFile(), dxfFile('Bad.dxf')]);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Bad.dxf')));
  });

  it('shows the server\'s reason when uploads are refused', async () => {
    vi.mocked(attachmentService.uploadFiles).mockRejectedValue(new Error('File storage not provisioned'));
    const { container } = renderTab(true);
    await screen.findByText(/no drawing yet/i);

    await userEvent.upload(fileInput(container), dxfFile());

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});

describe('SalesOrderDrawingTab removing a file', () => {
  it('asks first, then removes the file and its sub-tab', async () => {
    vi.mocked(attachmentService.listAttachments).mockResolvedValue([attachment()]);
    vi.mocked(attachmentService.deleteAttachment).mockResolvedValue();
    renderTab(true);

    await userEvent.click(await screen.findByRole('button', { name: 'Delete Kitchen.dxf' }));
    expect(attachmentService.deleteAttachment).not.toHaveBeenCalled();

    vi.mocked(attachmentService.listAttachments).mockResolvedValue([]);
    const confirm = screen.getByRole('group', { name: 'Confirm delete' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Confirm delete Kitchen.dxf' }));

    expect(attachmentService.deleteAttachment).toHaveBeenCalledWith('so-1', 'att-1');
    expect(await screen.findByText(/no drawing yet/i)).toBeDefined();
    expect(screen.queryByRole('tab', { name: 'Kitchen.dxf' })).toBeNull();
  });

  it('can back out', async () => {
    vi.mocked(attachmentService.listAttachments).mockResolvedValue([attachment()]);
    renderTab(true);

    await userEvent.click(await screen.findByRole('button', { name: 'Delete Kitchen.dxf' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel delete' }));

    expect(attachmentService.deleteAttachment).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Delete Kitchen.dxf' })).toBeDefined();
  });

  it('moves to the next file when the open one is removed', async () => {
    vi.mocked(attachmentService.listAttachments).mockResolvedValue([
      attachment({ id: 'att-1', createdAt: '2026-11-01T00:00:00Z' }),
      attachment({ id: 'att-2', fileName: 'Master.dxf', createdAt: '2026-11-02T00:00:00Z' }),
    ]);
    vi.mocked(attachmentService.deleteAttachment).mockResolvedValue();
    renderTab(true);

    await userEvent.click(await screen.findByRole('button', { name: 'Delete Kitchen.dxf' }));
    vi.mocked(attachmentService.listAttachments).mockResolvedValue([
      attachment({ id: 'att-2', fileName: 'Master.dxf', createdAt: '2026-11-02T00:00:00Z' }),
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Confirm delete Kitchen.dxf' }));

    expect(await screen.findByRole('img', { name: 'Master.dxf' })).toBeDefined();
  });

  it('downloads through a fresh link', async () => {
    vi.mocked(attachmentService.listAttachments).mockResolvedValue([attachment()]);
    vi.mocked(attachmentService.downloadAttachment).mockResolvedValue({ downloadUrl: 'https://r2.test/signed', fileName: 'Kitchen.dxf' });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderTab(false);

    await userEvent.click(await screen.findByRole('button', { name: 'Download Kitchen.dxf' }));

    await waitFor(() => expect(attachmentService.downloadAttachment).toHaveBeenCalledWith('so-1', 'att-1'));
    await waitFor(() => expect(click).toHaveBeenCalled());
    click.mockRestore();
  });
});
