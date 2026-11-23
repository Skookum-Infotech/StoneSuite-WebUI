import { describe, it, expect } from 'vitest';
import { validateDocumentFile, documentContentType, MAX_DOCUMENT_UPLOAD_BYTES } from './documentUploadValidation';

// File.size comes from the content, so override it instead of allocating a
// 10 MB buffer just to land on either side of the limit.
function makeFile(name: string, type: string, size: number): File {
  const file = new File([], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const image = (name: string) =>
  `${name} is an image — scanned images aren't supported yet. Upload the original PDF or Word (.docx) file.`;
const unsupported = (name: string) =>
  `${name} isn't a PDF or Word (.docx) file. Save it as a PDF or .docx and try again.`;

describe('validateDocumentFile', () => {
  const cases: Array<[string, File, string | null]> = [
    ['accepts a PDF', makeFile('so-1001.pdf', 'application/pdf', 1024), null],
    ['accepts a DOCX', makeFile('po-7.docx', DOCX_MIME, 1024), null],
    ['accepts a DOCX with an empty type', makeFile('po-7.DOCX', '', 1024), null],
    ['rejects a PNG', makeFile('bill.png', 'image/png', 1024), image('bill.png')],
    ['rejects a JPEG', makeFile('bill.jpg', 'image/jpeg', 1024), image('bill.jpg')],
    ['rejects a legacy .doc', makeFile('old.doc', 'application/msword', 1024), unsupported('old.doc')],
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
    ['rejects an unsupported image type', makeFile('photo.heic', 'image/heic', 1024), image('photo.heic')],
    ['rejects an empty file', makeFile('so-1001.pdf', 'application/pdf', 0), 'so-1001.pdf is empty — choose a file with content.'],
    [
      'rejects a file over the size limit',
      makeFile('big.pdf', 'application/pdf', MAX_DOCUMENT_UPLOAD_BYTES + 1),
      'big.pdf is larger than 10 MB — split it or enter the order manually.',
    ],
  ];

  it.each(cases)('%s', (_label, file, expected) => {
    expect(validateDocumentFile(file)).toBe(expected);
  });
});

describe('documentContentType', () => {
  it.each([
    ['keeps a known type', makeFile('a.pdf', 'application/pdf', 1), 'application/pdf'],
    ['derives PDF from the extension when empty', makeFile('A.PDF', '', 1), 'application/pdf'],
    ['derives DOCX from the extension for octet-stream', makeFile('po.docx', 'application/octet-stream', 1), DOCX_MIME],
    ['leaves an unknown extension alone', makeFile('notes', '', 1), ''],
  ])('%s', (_n, file, want) => {
    expect(documentContentType(file)).toBe(want);
  });
});
