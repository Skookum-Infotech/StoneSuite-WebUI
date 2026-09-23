import { describe, it, expect } from 'vitest';
import { validateDocumentFile, MAX_DOCUMENT_UPLOAD_BYTES } from './documentUploadValidation';

// File.size comes from the content, so override it instead of allocating a
// 25 MB buffer just to land on either side of the limit.
function makeFile(name: string, type: string, size: number): File {
  const file = new File([], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

const unsupported = (name: string) => `"${name}" isn't a supported file type — upload a PDF, PNG, or JPG.`;

describe('validateDocumentFile', () => {
  const cases: Array<[string, File, string | null]> = [
    ['accepts a PDF', makeFile('so-1001.pdf', 'application/pdf', 1024), null],
    ['accepts a PNG', makeFile('bill.png', 'image/png', 1024), null],
    ['accepts a JPEG', makeFile('bill.jpg', 'image/jpeg', 1024), null],
    [
      'accepts a file exactly at the size limit',
      makeFile('big.pdf', 'application/pdf', MAX_DOCUMENT_UPLOAD_BYTES),
      null,
    ],
    ['accepts an empty type when the extension is supported', makeFile('SCAN.PDF', '', 1024), null],
    ['accepts a supported type when the name has no extension', makeFile('scan', 'application/pdf', 1024), null],
    [
      'rejects a spreadsheet',
      makeFile('items.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 1024),
      unsupported('items.xlsx'),
    ],
    ['rejects an unsupported image type', makeFile('photo.heic', 'image/heic', 1024), unsupported('photo.heic')],
    ['rejects an empty file', makeFile('so-1001.pdf', 'application/pdf', 0), '"so-1001.pdf" is empty.'],
    [
      'rejects a file over the size limit',
      makeFile('big.pdf', 'application/pdf', MAX_DOCUMENT_UPLOAD_BYTES + 1),
      '"big.pdf" is larger than the 25 MB limit.',
    ],
  ];

  it.each(cases)('%s', (_label, file, expected) => {
    expect(validateDocumentFile(file)).toBe(expected);
  });
});
