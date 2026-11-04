import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/attachmentService', () => ({
  attachmentService: {
    listAttachments: vi.fn(),
    presignBatch: vi.fn(),
    uploadToR2: vi.fn(),
    confirmAttachments: vi.fn(),
  },
}));

import { attachmentService } from '@/services/attachmentService';
import { DXF_CONTENT_TYPE } from '@/lib/drawing/dxfFiles';
import { FilesContent } from './CrmSubTabsPanel';

function renderFiles() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { container } = render(
    <QueryClientProvider client={queryClient}>
      <FilesContent ref={null} recordId="so-1" readOnly={false} />
    </QueryClientProvider>,
  );
  return container.querySelector('input[type="file"]') as HTMLInputElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(attachmentService.listAttachments).mockResolvedValue([]);
  vi.mocked(attachmentService.presignBatch).mockResolvedValue([
    { fileName: 'Kitchen.dxf', storageKey: 'admin/so/so-1/k.dxf', uploadUrl: 'https://r2.test/put' },
  ]);
  vi.mocked(attachmentService.uploadToR2).mockResolvedValue();
  vi.mocked(attachmentService.confirmAttachments).mockResolvedValue([]);
});

describe('FilesContent with a DXF', () => {
  it('tells the user DXF is accepted', async () => {
    renderFiles();
    expect(await screen.findByText(/PDF, DOCX, XLSX, PNG, JPG, DXF/)).toBeDefined();
  });

  // A browser reports no type for .dxf; every step of the upload has to carry
  // the canonical one, since the presigned PUT is signed against it.
  it('uploads a .dxf the browser reported no type for, with the canonical type throughout', async () => {
    const input = renderFiles();
    await userEvent.upload(input, new File(['0\nEOF'], 'Kitchen.dxf', { type: '' }));

    await waitFor(() => expect(attachmentService.confirmAttachments).toHaveBeenCalled());
    expect(vi.mocked(attachmentService.presignBatch).mock.calls[0][1][0].contentType).toBe(DXF_CONTENT_TYPE);
    expect(vi.mocked(attachmentService.uploadToR2).mock.calls[0][1].type).toBe(DXF_CONTENT_TYPE);
    expect(vi.mocked(attachmentService.confirmAttachments).mock.calls[0][1][0].contentType).toBe(DXF_CONTENT_TYPE);
  });
});
