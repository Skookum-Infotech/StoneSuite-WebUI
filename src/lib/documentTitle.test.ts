import { describe, it, expect } from 'vitest';
import { buildDocumentTitle, APP_TITLE } from './documentTitle';

const RECORD_ID = '91b32990-4f89-4cb3-996c-347c2f60c6c1';

describe('buildDocumentTitle', () => {
  it.each([
    ['no segments', '/', {}, APP_TITLE],
    ['a top-level page', '/dashboard', {}, 'Dashboard · Stone Suite'],
    ['a snake_case list page', '/sales/sales_order', {}, 'Sales Order · Sales · Stone Suite'],
    ['a new-record page', '/sales/invoice/new', {}, 'New · Invoice · Stone Suite'],
    ['a record id with a pushed label', `/sales/invoice/${RECORD_ID}`, { [RECORD_ID]: 'INVC-000003' }, 'INVC-000003 · Invoice · Stone Suite'],
    ['a record id before its label loads', `/sales/invoice/${RECORD_ID}`, {}, 'Details · Invoice · Stone Suite'],
  ])('%s', (_name, pathname, labels, expected) => {
    expect(buildDocumentTitle(pathname, labels)).toBe(expected);
  });
});
