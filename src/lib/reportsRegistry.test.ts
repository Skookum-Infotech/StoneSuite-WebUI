import { describe, it, expect } from 'vitest';
import { sidebarNav } from '@/config/sidebarNav';
import { buildPermModules } from './permissionMatrix';
import { REPORT_MODULES, findReportModule } from './reportsRegistry';

describe('REPORT_MODULES', () => {
  it('has unique module slugs and unique report ids per module', () => {
    expect(new Set(REPORT_MODULES.map((m) => m.slug)).size).toBe(REPORT_MODULES.length);
    for (const m of REPORT_MODULES) {
      expect(new Set(m.reports.map((r) => r.id)).size).toBe(m.reports.length);
    }
  });

  it('puts every built report under its own module path', () => {
    for (const m of REPORT_MODULES) {
      for (const r of m.reports) {
        if (r.path) expect(r.path.startsWith(`/reports/${m.slug}/`)).toBe(true);
      }
    }
  });

  it('gates each module with report_<slug>', () => {
    for (const m of REPORT_MODULES) expect(m.resource).toBe(`report_${m.slug}`);
  });

  it('has a Reports sidebar link for every module, gated by the same resource', () => {
    const group = sidebarNav.sections
      .flatMap((s) => s.entries)
      .find((e) => e.type === 'group' && e.id === 'reports');
    expect(group?.type).toBe('group');
    const links = group?.type === 'group' ? group.children : [];
    for (const m of REPORT_MODULES) {
      const link = links.find((l) => l.path === `/reports/${m.slug}`);
      expect(link?.permission).toEqual({ resource: m.resource, action: 'read' });
    }
  });

  it('shows one row per report resource in the role matrix, and none for the parked Custom page', () => {
    const rows = buildPermModules().find((m) => m.id === 'reports')?.rows ?? [];
    expect(rows.map((r) => r.resource)).toEqual(REPORT_MODULES.map((m) => m.resource));
  });
});

describe('findReportModule', () => {
  it('finds a module by slug and returns undefined for an unknown one', () => {
    expect(findReportModule('sales')?.label).toBe('Sales');
    expect(findReportModule('nope')).toBeUndefined();
    expect(findReportModule(undefined)).toBeUndefined();
  });
});
