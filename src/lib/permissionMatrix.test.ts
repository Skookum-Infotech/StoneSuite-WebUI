import { describe, it, expect } from 'vitest';
import { buildPermModules } from './permissionMatrix';

describe('buildPermModules', () => {
  it('never lists the same backend resource in two rows', () => {
    const modules = buildPermModules();
    const resources = modules.flatMap((m) => m.rows.map((r) => r.resource));
    expect(resources).toHaveLength(new Set(resources).size);
  });

  it('keeps "Leads" for the shared lead resource, not the Import Data link that reuses it for sidebar gating', () => {
    const modules = buildPermModules();
    const leadRows = modules
      .flatMap((m) => m.rows)
      .filter((r) => r.resource === 'lead');

    expect(leadRows).toHaveLength(1);
    expect(leadRows[0]?.label).toBe('Leads');
  });

  it('drops the Default Accounts row once chart_of_account is already covered by Chart of Accounts', () => {
    const modules = buildPermModules();
    const coaRows = modules
      .flatMap((m) => m.rows)
      .filter((r) => r.resource === 'chart_of_account');

    expect(coaRows).toHaveLength(1);
    expect(coaRows[0]?.label).toBe('Chart of Accounts');
  });
});
