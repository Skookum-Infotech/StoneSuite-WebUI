import type { KeyboardEvent } from 'react';

/** Keydown handler for a line-item table that sits inside a document form.
 *
 *  The boxes of an inline line row are inputs of the page's own <form>, so Enter
 *  in any of them would submit — and save — the whole document half-way through
 *  typing a line. A line has its own Save Line button, so Enter in a box is
 *  swallowed here instead. Only inputs: Enter must still press the buttons (Edit,
 *  Remove, Save Line) and a picker keeps handling its own Enter before this runs. */
export function blockEnterSubmit(e: KeyboardEvent<HTMLElement>): void {
  if (e.key === 'Enter' && e.target instanceof HTMLInputElement) e.preventDefault();
}
