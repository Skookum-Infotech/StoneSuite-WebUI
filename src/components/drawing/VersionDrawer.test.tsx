import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Drawing } from '@/types/drawing';

vi.mock('@/services/drawingService', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  drawingService: { listVersions: vi.fn(), getVersion: vi.fn(), restoreVersion: vi.fn() },
}));

import { DrawingConflictError, drawingService } from '@/services/drawingService';
import { VersionDrawer } from './VersionDrawer';

function drawing(overrides: Partial<Drawing> = {}): Drawing {
  return {
    schemaVersion: 1,
    salesOrderId: 'so1',
    version: 1,
    displayUnit: 'in',
    fractionDenominator: 32,
    areas: [{ id: 'a1', name: 'Area 1', code: '', sortOrder: 0, pieces: [{ id: 'p1' }] as never, cabinets: [], notes: [] }],
    updatedAt: '2026-11-03T00:00:00.000Z',
    updatedBy: { id: 'u1', name: 'Test User' },
    ...overrides,
  };
}

function renderDrawer(overrides: Partial<Parameters<typeof VersionDrawer>[0]> = {}) {
  const onRestored = vi.fn();
  const onClose = vi.fn();
  render(<VersionDrawer salesOrderId="so1" currentVersion={2} onRestored={onRestored} onClose={onClose} {...overrides} />);
  return { onRestored, onClose };
}

describe('VersionDrawer', () => {
  it('lists versions with their updatedAt and updatedBy', async () => {
    vi.mocked(drawingService.listVersions).mockResolvedValue({
      items: [
        { version: 2, updatedAt: '2026-11-03T01:00:00.000Z', updatedBy: { id: 'u1', name: 'Alice' } },
        { version: 1, updatedAt: '2026-11-03T00:00:00.000Z', updatedBy: { id: 'u2', name: 'Bob' } },
      ],
      nextCursor: null,
    });
    renderDrawer();
    expect(await screen.findByText(/Alice/)).toBeDefined();
    expect(screen.getByText(/Bob/)).toBeDefined();
  });

  it('clicking a version fetches and previews it', async () => {
    vi.mocked(drawingService.listVersions).mockResolvedValue({
      items: [{ version: 1, updatedAt: '2026-11-03T00:00:00.000Z', updatedBy: { id: 'u1', name: 'Alice' } }],
      nextCursor: null,
    });
    vi.mocked(drawingService.getVersion).mockResolvedValue(drawing());
    renderDrawer();
    await userEvent.click(await screen.findByRole('button', { name: /version 1/i }));
    expect(drawingService.getVersion).toHaveBeenCalledWith('so1', 1);
    expect(await screen.findByText(/1 area/i)).toBeDefined();
    expect(screen.getByText(/1 piece/i)).toBeDefined();
  });

  it('restoring calls restoreVersion with the clicked version and the drawer\'s currentVersion, then onRestored', async () => {
    vi.mocked(drawingService.listVersions).mockResolvedValue({
      items: [{ version: 1, updatedAt: '2026-11-03T00:00:00.000Z', updatedBy: { id: 'u1', name: 'Alice' } }],
      nextCursor: null,
    });
    vi.mocked(drawingService.getVersion).mockResolvedValue(drawing());
    const restored = drawing({ version: 3 });
    vi.mocked(drawingService.restoreVersion).mockResolvedValue(restored);
    const { onRestored } = renderDrawer({ currentVersion: 2 });

    await userEvent.click(await screen.findByRole('button', { name: /version 1/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Restore this version' }));

    expect(drawingService.restoreVersion).toHaveBeenCalledWith('so1', 1, 2);
    expect(onRestored).toHaveBeenCalledWith(restored);
  });

  it('a restore conflict shows an inline error instead of throwing', async () => {
    vi.mocked(drawingService.listVersions).mockResolvedValue({
      items: [{ version: 1, updatedAt: '2026-11-03T00:00:00.000Z', updatedBy: { id: 'u1', name: 'Alice' } }],
      nextCursor: null,
    });
    vi.mocked(drawingService.getVersion).mockResolvedValue(drawing());
    vi.mocked(drawingService.restoreVersion).mockRejectedValue(new DrawingConflictError());
    const { onRestored } = renderDrawer();

    await userEvent.click(await screen.findByRole('button', { name: /version 1/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Restore this version' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/changed by someone else/i);
    expect(onRestored).not.toHaveBeenCalled();
  });
});
