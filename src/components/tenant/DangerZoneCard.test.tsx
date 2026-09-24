import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DangerZoneAction } from './DangerZoneCard';

function renderAction(props: Partial<Parameters<typeof DangerZoneAction>[0]> = {}) {
  const onClick = vi.fn();
  render(<DangerZoneAction description="Do the thing." buttonLabel="Do it" onClick={onClick} {...props} />);
  return { onClick };
}

describe('DangerZoneAction', () => {
  it('fires onClick and says it cannot be undone', async () => {
    const { onClick } = renderAction();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Do it' }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('uses ariaLabel as the accessible name when given', () => {
    renderAction({ ariaLabel: 'Do it to Vendor Bill VB-1' });

    expect(screen.getByRole('button', { name: 'Do it to Vendor Bill VB-1' })).toBeInTheDocument();
  });

  it('is enabled and shows no hint by default', () => {
    renderAction();

    expect(screen.getByRole('button', { name: 'Do it' })).toBeEnabled();
  });

  it('renders inert, with the reason visible, when disabled', async () => {
    const { onClick } = renderAction({ disabled: true, hint: 'Awaiting approval sign-off' });

    const button = screen.getByRole('button', { name: 'Do it' });
    expect(button).toBeDisabled();
    expect(screen.getByText('Awaiting approval sign-off')).toBeInTheDocument();
    await userEvent.setup().click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
