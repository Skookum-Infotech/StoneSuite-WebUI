import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WidgetTile } from './WidgetTile';
import type { WidgetDefinition } from '@/types/dashboardWidgets';

const WIDGET: WidgetDefinition = {
  id: 'kpi-strip',
  title: 'KPI Strip',
  description: 'Revenue, open leads, sales orders, and approvals at a glance.',
  category: 'core',
  size: 'full',
  defaultEnabled: true,
};

describe('WidgetTile', () => {
  it('renders unchecked with an "Add" label', () => {
    render(<WidgetTile widget={WIDGET} checked={false} onToggle={vi.fn()} />);
    const tile = screen.getByRole('button', { name: 'Add KPI Strip' });
    expect(tile).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders checked with a "Remove" label', () => {
    render(<WidgetTile widget={WIDGET} checked onToggle={vi.fn()} />);
    const tile = screen.getByRole('button', { name: 'Remove KPI Strip' });
    expect(tile).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onToggle(true) when clicking an unchecked tile', async () => {
    const onToggle = vi.fn();
    render(<WidgetTile widget={WIDGET} checked={false} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add KPI Strip' }));
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('calls onToggle(false) when clicking a checked tile', async () => {
    const onToggle = vi.fn();
    render(<WidgetTile widget={WIDGET} checked onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove KPI Strip' }));
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('is disabled and inert when disabled is set', async () => {
    const onToggle = vi.fn();
    render(<WidgetTile widget={WIDGET} checked disabled onToggle={onToggle} />);
    const tile = screen.getByRole('button', { name: 'Remove KPI Strip' });
    expect(tile).toBeDisabled();
    await userEvent.click(tile);
    expect(onToggle).not.toHaveBeenCalled();
  });
});
