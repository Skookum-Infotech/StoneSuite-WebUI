import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DxfScene } from '@/lib/drawing/dxfSceneTypes';
import { DxfViewer } from './DxfViewer';

const scene: DxfScene = {
  paths: [
    { d: 'M0 0L100 0', dashed: false, filled: false },
    { d: 'M0 10L100 10', dashed: true, filled: false },
    { d: 'M0 0L1 0L1 1Z', dashed: false, filled: true },
  ],
  texts: [{ text: '91 7/32"', x: 50, y: 25, height: 2, rotationDeg: 90, anchor: 'middle', baseline: 'middle' }],
  bounds: { minX: 0, minY: 0, maxX: 100, maxY: 50 },
  unsupported: {},
};

function svg() {
  return screen.getByRole('img', { name: 'Kitchen.dxf' });
}

function viewBox() {
  const [x, y, w, h] = (svg().getAttribute('viewBox') ?? '').split(' ').map(Number);
  return { x, y, w, h };
}

beforeEach(() => {
  Element.prototype.setPointerCapture = vi.fn();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 400, height: 200, right: 400, bottom: 200, x: 0, y: 0, toJSON: () => ({}),
  });
});

describe('DxfViewer', () => {
  it('draws every path', () => {
    render(<DxfViewer scene={scene} label="Kitchen.dxf" />);
    expect(svg().querySelectorAll('path')).toHaveLength(3);
  });

  it('dashes the dashed paths and fills the filled ones', () => {
    render(<DxfViewer scene={scene} label="Kitchen.dxf" />);
    const [solid, dashed, filled] = svg().querySelectorAll('path');
    expect(solid.getAttribute('stroke-dasharray')).toBeNull();
    expect(dashed.getAttribute('stroke-dasharray')).not.toBeNull();
    expect(filled.getAttribute('class')).toContain('fill-stone-800');
  });

  it('turns CAD counter-clockwise rotation into SVG clockwise rotation', () => {
    render(<DxfViewer scene={scene} label="Kitchen.dxf" />);
    expect(screen.getByText('91 7/32"').getAttribute('transform')).toBe('rotate(-90 50 25)');
  });

  // The file is untrusted: its text must stay text.
  it('never turns text from the file into markup', () => {
    const malicious: DxfScene = { ...scene, texts: [{ ...scene.texts[0], text: '<img src=x onerror=alert(1)>' }] };
    const { container } = render(<DxfViewer scene={malicious} label="Kitchen.dxf" />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeDefined();
  });

  it('starts with the whole drawing in view', () => {
    render(<DxfViewer scene={scene} label="Kitchen.dxf" />);
    const vb = viewBox();
    expect(vb.x).toBeLessThan(0);
    expect(vb.x + vb.w).toBeGreaterThan(100);
  });

  it('zooms in and back to fit with the buttons', async () => {
    render(<DxfViewer scene={scene} label="Kitchen.dxf" />);
    const fitted = viewBox();
    await userEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(viewBox().w).toBeLessThan(fitted.w);
    await userEvent.click(screen.getByRole('button', { name: 'Fit to screen' }));
    expect(viewBox()).toEqual(fitted);
  });

  it('zooms out with the button', async () => {
    render(<DxfViewer scene={scene} label="Kitchen.dxf" />);
    const fitted = viewBox();
    await userEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(viewBox().w).toBeGreaterThan(fitted.w);
  });

  it('zooms with the mouse wheel, without scrolling the page', () => {
    render(<DxfViewer scene={scene} label="Kitchen.dxf" />);
    const fitted = viewBox();
    const wheel = new WheelEvent('wheel', { deltaY: -100, clientX: 200, clientY: 100, bubbles: true, cancelable: true });
    fireEvent(svg(), wheel);
    expect(viewBox().w).toBeLessThan(fitted.w);
    expect(wheel.defaultPrevented).toBe(true);
  });

  it('pans when dragged', () => {
    render(<DxfViewer scene={scene} label="Kitchen.dxf" />);
    const before = viewBox();
    fireEvent(svg(), new MouseEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true }));
    fireEvent(svg(), new MouseEvent('pointermove', { clientX: 140, clientY: 100, bubbles: true }));
    expect(viewBox().x).toBeLessThan(before.x);
    const moved = viewBox().x;
    fireEvent(svg(), new MouseEvent('pointerup', { clientX: 140, clientY: 100, bubbles: true }));
    fireEvent(svg(), new MouseEvent('pointermove', { clientX: 300, clientY: 100, bubbles: true }));
    expect(viewBox().x).toBe(moved);
  });

  // Every drag step re-renders; re-creating thousands of <text> nodes each time
  // would freeze the page, out of reach of the worker's timeout.
  it('does not rebuild the drawing while zooming', async () => {
    const texts = [...scene.texts];
    const build = vi.spyOn(texts, 'map');
    render(<DxfViewer scene={{ ...scene, texts }} label="Kitchen.dxf" />);
    const calls = build.mock.calls.length;

    await userEvent.click(screen.getByRole('button', { name: 'Zoom in' }));

    expect(build.mock.calls.length).toBe(calls);
  });

  it('works from the keyboard', () => {
    render(<DxfViewer scene={scene} label="Kitchen.dxf" />);
    const fitted = viewBox();
    const region = screen.getByRole('group', { name: 'Kitchen.dxf drawing viewer' });

    fireEvent.keyDown(region, { key: 'ArrowRight' });
    expect(viewBox().x).toBeGreaterThan(fitted.x);
    fireEvent.keyDown(region, { key: '+' });
    expect(viewBox().w).toBeLessThan(fitted.w);
    fireEvent.keyDown(region, { key: '0' });
    expect(viewBox()).toEqual(fitted);
  });
});
