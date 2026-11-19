// @vitest-environment jsdom
// The rail down the left of the board: the pointer, Draw, Text and Border (with
// its flyout), Corner (likewise), Edges and Profiles, which both arm straight
// away (their type is picked in the bottom bar).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Drawing } from '@/types/drawing';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';
import { ToolRail } from './ToolRail';

const drawing: Drawing = {
  schemaVersion: 1, salesOrderId: 's', version: 0, displayUnit: 'mm', fractionDenominator: 32,
  areas: [{ id: 'a', name: 'A', code: '', sortOrder: 0, pieces: [], cabinets: [], notes: [] }],
  updatedAt: '', updatedBy: { id: 'u', name: 'U' },
};

function Readout() {
  const { tool } = useDrawingEditor();
  return <span data-testid="tool">{tool}</span>;
}

function StyleReadout() {
  const { border, corner } = useDrawingEditor();
  return (
    <>
      <span data-testid="border-style">{border.style}</span>
      <span data-testid="corner-style">{corner.style}</span>
    </>
  );
}

function open() {
  render(
    <DrawingEditorProvider drawing={drawing} materialLines={[]}>
      <ToolRail />
      <Readout />
      <StyleReadout />
    </DrawingEditorProvider>,
  );
  return userEvent.setup();
}

const tool = () => screen.getByTestId('tool').textContent;

afterEach(() => vi.restoreAllMocks());

describe('ToolRail', () => {
  it('holds the pointer, Draw, Text, Border, Corner, Edges and Profiles — no Line and no other sections', () => {
    open();
    const rail = screen.getByRole('navigation', { name: 'Drawing tools' });
    expect(within(rail).getAllByRole('button').map((b) => b.getAttribute('aria-label')))
      .toEqual(['Select', 'Draw', 'Text', 'Border', 'Corner', 'Edges', 'Profiles']);
    for (const gone of ['Line', 'Shapes', 'Cutouts', 'Annotations', 'Materials']) {
      expect(screen.queryByRole('button', { name: gone })).toBeNull();
    }
  });

  it('starts on Select', () => {
    open();
    expect(screen.getByRole('button', { name: 'Select' }).getAttribute('aria-pressed')).toBe('true');
    expect(tool()).toBe('select');
  });

  it('arms Draw and Text, and lights only the armed tool', async () => {
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Draw' }));
    expect(tool()).toBe('draw');
    expect(screen.getByRole('button', { name: 'Draw' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Select' }).getAttribute('aria-pressed')).toBe('false');
    await user.click(screen.getByRole('button', { name: 'Text' }));
    expect(tool()).toBe('text');
    expect(screen.getByRole('button', { name: 'Draw' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('Edges arms with one click, lights while armed, and puts itself away on a second', async () => {
    const user = open();
    const edges = screen.getByRole('button', { name: 'Edges' });
    expect((edges as HTMLButtonElement).disabled).toBe(false);
    // No flyout: its list lives in the bottom bar.
    expect(edges.getAttribute('aria-haspopup')).toBeNull();
    await user.click(edges);
    expect(tool()).toBe('edge');
    expect(edges.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Select' }).getAttribute('aria-pressed')).toBe('false');
    await user.click(edges);
    expect(tool()).toBe('select');
  });

  it('Profiles arms with one click, lights while armed, and puts itself away on a second', async () => {
    const user = open();
    const profiles = screen.getByRole('button', { name: 'Profiles' });
    expect((profiles as HTMLButtonElement).disabled).toBe(false);
    // No flyout: its list lives in the bottom bar.
    expect(profiles.getAttribute('aria-haspopup')).toBeNull();
    await user.click(profiles);
    expect(tool()).toBe('profile');
    expect(profiles.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Select' }).getAttribute('aria-pressed')).toBe('false');
    await user.click(profiles);
    expect(tool()).toBe('select');
  });

  it('switching from Edges to Border or Corner lights only the new tool', async () => {
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Edges' }));
    await user.click(screen.getByRole('button', { name: 'Corner' }));
    await user.click(screen.getByRole('menuitem', { name: 'Clip' }));
    expect(tool()).toBe('corner');
    expect(screen.getByRole('button', { name: 'Edges' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('Corner opens a flyout of the six changes, and picking one arms the tool with it', async () => {
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Corner' }));
    const menu = screen.getByRole('menu', { name: 'Corners (C)' });
    expect(within(menu).getAllByRole('menuitem').map((i) => i.getAttribute('aria-label'))).toEqual([
      'Clip', 'Radius', 'Radius In', 'Bump Out', 'Bump In', 'Notch',
    ]);
    await user.click(within(menu).getByRole('menuitem', { name: 'Notch' }));
    expect(tool()).toBe('corner');
    expect(screen.getByTestId('corner-style').textContent).toBe('notch');
    expect(screen.getByRole('button', { name: 'Corner' }).getAttribute('aria-pressed')).toBe('true');
    // Armed, the button puts the tool away; Border and Corner never light together.
    await user.click(screen.getByRole('button', { name: 'Corner' }));
    expect(tool()).toBe('select');
    await user.click(screen.getByRole('button', { name: 'Border' }));
    await user.click(screen.getByRole('menuitem', { name: 'Bump Out' }));
    expect(screen.getByRole('button', { name: 'Corner' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('Border opens a flyout of the six reshapes, and picking one arms the tool with it', async () => {
    const user = open();
    expect(screen.queryByRole('menu')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Border' }));
    const menu = screen.getByRole('menu', { name: 'Borders (B)' });
    expect(within(menu).getAllByRole('menuitem').map((i) => i.getAttribute('aria-label'))).toEqual([
      'Full Radius Out', 'Full Radius In', 'Bump Out', 'Bump In', 'Arc Bump Out', 'Arc Bump In',
    ]);
    expect(tool()).toBe('select');
    await user.click(within(menu).getByRole('menuitem', { name: 'Arc Bump In' }));
    expect(tool()).toBe('border');
    expect(screen.getByTestId('border-style').textContent).toBe('arcBumpIn');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('button', { name: 'Border' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('the flyout closes on Escape or a press elsewhere, and an armed Border toggles off', async () => {
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Border' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Border' }));
    await user.click(screen.getByTestId('tool'));
    expect(screen.queryByRole('menu')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Border' }));
    await user.click(screen.getByRole('menuitem', { name: 'Bump Out' }));
    await user.click(screen.getByRole('button', { name: 'Border' }));
    expect(tool()).toBe('select');
  });

  it('pressing an armed tool again, or Select, hands back to Select', async () => {
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Text' }));
    await user.click(screen.getByRole('button', { name: 'Text' }));
    expect(tool()).toBe('select');
    await user.click(screen.getByRole('button', { name: 'Draw' }));
    await user.click(screen.getByRole('button', { name: 'Select' }));
    expect(tool()).toBe('select');
  });
});
