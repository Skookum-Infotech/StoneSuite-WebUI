// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { attachmentService } from './attachmentService';

const file = (name: string) => new File(['0\nEOF'], name, { type: 'application/dxf' });

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(attachmentService, 'presignBatch').mockImplementation(async (_id, files) =>
    files.map((f) => ({ fileName: f.fileName, storageKey: `key/${f.fileName}`, uploadUrl: `https://r2.test/${f.fileName}` })));
  vi.spyOn(attachmentService, 'uploadToR2').mockResolvedValue();
  vi.spyOn(attachmentService, 'confirmAttachments').mockImplementation(async (_id, rows) =>
    rows.map((r) => ({ id: r.storageKey, fileName: r.fileName }) as never));
});

describe('attachmentService.uploadFiles', () => {
  it('presigns, uploads and confirms every file', async () => {
    const result = await attachmentService.uploadFiles('so-1', [file('a.dxf'), file('b.dxf')]);

    expect(attachmentService.uploadToR2).toHaveBeenCalledTimes(2);
    expect(vi.mocked(attachmentService.confirmAttachments).mock.calls[0][1].map((r) => r.fileName)).toEqual(['a.dxf', 'b.dxf']);
    expect(result.uploaded.map((a) => a.fileName)).toEqual(['a.dxf', 'b.dxf']);
    expect(result.failed).toEqual([]);
  });

  // The backend takes at most 10 files per presign/confirm call.
  it('splits a large selection into batches the backend accepts', async () => {
    const files = Array.from({ length: 12 }, (_, i) => file(`${i}.dxf`));
    const result = await attachmentService.uploadFiles('so-1', files);

    expect(vi.mocked(attachmentService.presignBatch).mock.calls.map((c) => c[1].length)).toEqual([10, 2]);
    expect(result.uploaded).toHaveLength(12);
  });

  it('keeps the files that made it and names the one that did not', async () => {
    vi.mocked(attachmentService.uploadToR2).mockImplementation(async (url) => {
      if (url.endsWith('bad.dxf')) throw new Error('network');
    });
    const result = await attachmentService.uploadFiles('so-1', [file('good.dxf'), file('bad.dxf')]);

    expect(result.uploaded.map((a) => a.fileName)).toEqual(['good.dxf']);
    expect(result.failed).toEqual(['bad.dxf']);
  });

  it('confirms nothing when every upload fails', async () => {
    vi.mocked(attachmentService.uploadToR2).mockRejectedValue(new Error('network'));
    const result = await attachmentService.uploadFiles('so-1', [file('a.dxf')]);

    expect(attachmentService.confirmAttachments).not.toHaveBeenCalled();
    expect(result).toEqual({ uploaded: [], failed: ['a.dxf'] });
  });

  // "File storage not provisioned" must reach the user, not read as a bad file.
  it('lets a refused presign reach the caller', async () => {
    vi.mocked(attachmentService.presignBatch).mockRejectedValue(new Error('File storage not provisioned'));
    await expect(attachmentService.uploadFiles('so-1', [file('a.dxf')])).rejects.toThrow('File storage not provisioned');
  });
});

describe('attachmentService.fetchAttachmentBytes', () => {
  it('reads the file from its short-lived link, without sending our credentials', async () => {
    vi.spyOn(attachmentService, 'downloadAttachment').mockResolvedValue({ downloadUrl: 'https://r2.test/signed', fileName: 'a.dxf' });
    const bytes = new ArrayBuffer(4);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(bytes) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(attachmentService.fetchAttachmentBytes('so-1', 'att-1')).resolves.toBe(bytes);
    expect(fetchMock).toHaveBeenCalledWith('https://r2.test/signed', expect.objectContaining({ credentials: 'omit' }));
    vi.unstubAllGlobals();
  });

  it('fails on a response storage refused', async () => {
    vi.spyOn(attachmentService, 'downloadAttachment').mockResolvedValue({ downloadUrl: 'https://r2.test/signed', fileName: 'a.dxf' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));

    await expect(attachmentService.fetchAttachmentBytes('so-1', 'att-1')).rejects.toThrow(/403/);
    vi.unstubAllGlobals();
  });
});
