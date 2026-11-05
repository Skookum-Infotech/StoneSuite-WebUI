import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConflictDialog } from './ConflictDialog';

function renderDialog(overrides: Partial<Parameters<typeof ConflictDialog>[0]> = {}) {
  const onReloadLatest = vi.fn();
  const onSaveAsCopy = vi.fn();
  const onClose = vi.fn();
  render(<ConflictDialog onReloadLatest={onReloadLatest} onSaveAsCopy={onSaveAsCopy} onClose={onClose} {...overrides} />);
  return { onReloadLatest, onSaveAsCopy, onClose };
}

describe('ConflictDialog', () => {
  it('renders as a modal dialog with Reload latest and Save as copy actions', () => {
    renderDialog();
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Reload latest' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Save as copy' })).toBeDefined();
  });

  it('clicking Reload latest calls onReloadLatest', async () => {
    const { onReloadLatest, onSaveAsCopy } = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Reload latest' }));
    expect(onReloadLatest).toHaveBeenCalledTimes(1);
    expect(onSaveAsCopy).not.toHaveBeenCalled();
  });

  it('clicking Save as copy calls onSaveAsCopy', async () => {
    const { onSaveAsCopy, onReloadLatest } = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Save as copy' }));
    expect(onSaveAsCopy).toHaveBeenCalledTimes(1);
    expect(onReloadLatest).not.toHaveBeenCalled();
  });

  it('Escape calls onClose', async () => {
    const { onClose } = renderDialog();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
