import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PickerNotFound } from './PickerNotFound';

describe('PickerNotFound', () => {
  it('offers to create it in a new tab when the record is not there', () => {
    render(<PickerNotFound entity="item" term="Nero Marquina" createHref="/inventory/item/new?name=Nero+Marquina" />);

    expect(screen.getByText(/“Nero Marquina” isn't an existing item/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Create “Nero Marquina” as a new item — opens in a new tab' });
    expect(link).toHaveAttribute('href', '/inventory/item/new?name=Nero+Marquina');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('says who can add it when the caller cannot create one', () => {
    render(<PickerNotFound entity="account" term="Petty Cash" />);

    expect(screen.getByText(/“Petty Cash” isn't an existing account/)).toBeInTheDocument();
    expect(screen.getByText(/Ask someone with account access/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('blocks create and links to the record that already has the name', () => {
    render(
      <PickerNotFound
        entity="item"
        term="nero marquina"
        createHref="/inventory/item/new?name=nero+marquina"
        existing={{ name: 'Nero Marquina', statusLabel: 'Inactive', href: '/inventory/item/it-9' }}
      />,
    );

    // "An item", not "A item".
    expect(screen.getByText('An item named “Nero Marquina” already exists (Inactive).')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open “Nero Marquina” — opens in a new tab' })).toHaveAttribute('href', '/inventory/item/it-9');
    expect(screen.queryByRole('link', { name: /Create/ })).not.toBeInTheDocument();
  });

  it('uses "A" before a consonant and omits an empty status', () => {
    render(<PickerNotFound entity="vendor" term="x" existing={{ name: 'Nero Co', href: '/purchases/vendor/v-1' }} />);

    expect(screen.getByText('A vendor named “Nero Co” already exists.')).toBeInTheDocument();
  });
});
