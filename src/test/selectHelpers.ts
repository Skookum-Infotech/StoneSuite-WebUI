import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The app's <Select> (components/ui/select.tsx) is a trigger + popover list,
// not a native <select>, so userEvent.selectOptions no longer applies: open
// the trigger, then click the option whose value (or visible label) matches.

// Clicks an option in the listbox that is already open.
export async function chooseOpenOption(valueOrLabel: string): Promise<void> {
  const listbox = await screen.findByRole('listbox');
  const options = within(listbox).getAllByRole('option');
  const match =
    options.find((o) => o.getAttribute('data-value') === valueOrLabel) ??
    options.find((o) => o.textContent?.trim() === valueOrLabel);
  if (!match) {
    throw new Error(`No option "${valueOrLabel}" in: ${options.map((o) => o.textContent?.trim()).join(' | ')}`);
  }
  await userEvent.setup().click(match);
}

// Opens the trigger, then picks the option.
export async function pickOption(trigger: HTMLElement, valueOrLabel: string): Promise<void> {
  await userEvent.setup().click(trigger);
  await chooseOpenOption(valueOrLabel);
}
