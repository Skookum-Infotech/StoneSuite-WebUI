import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { FILL_TOP_VAR, useFillViewport } from './useFillViewport';

function Probe() {
  const ref = useFillViewport<HTMLDivElement>();
  return <div ref={ref} data-testid="probe" />;
}

let top = 97;
let observed: Array<() => void> = [];

beforeEach(() => {
  top = 97;
  observed = [];
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ top, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: top, toJSON: () => ({}) }),
  );
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { observed.push(callback); }
    observe() {}
    disconnect() {}
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const fillTop = (el: HTMLElement) => el.style.getPropertyValue(FILL_TOP_VAR);

describe('useFillViewport', () => {
  // The editor must end exactly at the bottom of the window: everything above
  // it (the header, the breadcrumb bar) is already part of how far down it starts.
  it('records how far down the page the element starts', () => {
    const { getByTestId } = render(<Probe />);
    expect(fillTop(getByTestId('probe'))).toBe('97px');
  });

  it('counts from the top of the page, not the top of the window, once it has scrolled', () => {
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(30);
    top = 67;
    const { getByTestId } = render(<Probe />);
    expect(fillTop(getByTestId('probe'))).toBe('97px');
  });

  it('measures again when the window is resized', () => {
    const { getByTestId } = render(<Probe />);
    top = 130; // the breadcrumb wrapped onto a second line
    act(() => { window.dispatchEvent(new Event('resize')); });
    expect(fillTop(getByTestId('probe'))).toBe('130px');
  });

  it('measures again when the page above it changes height', () => {
    const { getByTestId } = render(<Probe />);
    top = 120;
    act(() => { observed.forEach((callback) => callback()); });
    expect(fillTop(getByTestId('probe'))).toBe('120px');
  });

  it('stops listening when the page is left', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<Probe />);
    unmount();
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('still works where ResizeObserver does not exist', () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('ResizeObserver', undefined);
    const { getByTestId } = render(<Probe />);
    expect(fillTop(getByTestId('probe'))).toBe('97px');
  });
});
