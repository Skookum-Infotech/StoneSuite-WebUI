import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SubscriptionPage from './SubscriptionPage'

// SubscriptionPage is a UI-only mock module (no backend contract — see
// types/subscription.ts), so these tests exercise real user flows against
// local component state rather than mocking network calls.

describe('SubscriptionPage — Plan tab', () => {
  it('upgrading from the current plan card updates the plan and shows a confirmation', async () => {
    const user = userEvent.setup()
    render(<SubscriptionPage />)

    expect(screen.getByRole('heading', { name: 'Pro Plan' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Upgrade plan' }))
    expect(screen.getByRole('dialog', { name: 'Upgrade to Enterprise' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirm upgrade to Enterprise' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Enterprise Plan' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Upgraded to Enterprise Plan.')
  })

  it('cancelling shows the destructive confirmation and updates status on confirm', async () => {
    const user = userEvent.setup()
    render(<SubscriptionPage />)

    await user.click(screen.getByRole('button', { name: 'Cancel subscription' }))
    expect(screen.getByRole('dialog', { name: 'Cancel your Pro plan?' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirm plan cancellation' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Canceled')).toBeInTheDocument()
  })

  it('keep plan closes the cancel dialog without changing status', async () => {
    const user = userEvent.setup()
    render(<SubscriptionPage />)

    await user.click(screen.getByRole('button', { name: 'Cancel subscription' }))
    await user.click(screen.getByRole('button', { name: 'Keep current plan' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('contact sales opens a form and submitting shows a confirmation', async () => {
    const user = userEvent.setup()
    render(<SubscriptionPage />)

    await user.click(screen.getByRole('button', { name: 'Contact Sales — Enterprise' }))
    const dialog = screen.getByRole('dialog', { name: 'Contact Sales' })

    await user.type(within(dialog).getByLabelText('Name'), 'Jane Doe')
    await user.type(within(dialog).getByLabelText('Work email'), 'jane@acme.com')
    await user.selectOptions(within(dialog).getByLabelText('Company size'), 'medium')
    await user.click(within(dialog).getByRole('button', { name: 'Send message to sales' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Thanks — our team will reach out within 1 business day.',
    )
  })
})

describe('SubscriptionPage — Payment tab', () => {
  async function goToPaymentTab(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Payment tab' }))
  }

  it('shows the default card and billing details side by side', async () => {
    const user = userEvent.setup()
    render(<SubscriptionPage />)
    await goToPaymentTab(user)

    expect(screen.getByText('•••• •••• •••• 4242')).toBeInTheDocument()
    expect(screen.getAllByText('Default')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Billing Details' })).toBeInTheDocument()
  })

  it('adds a new card via the mock form', async () => {
    const user = userEvent.setup()
    render(<SubscriptionPage />)
    await goToPaymentTab(user)

    await user.click(screen.getByRole('button', { name: 'Add payment method' }))
    const dialog = screen.getByRole('dialog', { name: 'Add Payment Method' })

    await user.type(within(dialog).getByLabelText('Card number'), '378282246310005')
    await user.type(within(dialog).getByLabelText('Expiry date'), '12/30')
    await user.type(within(dialog).getByLabelText('CVC'), '1234')
    await user.type(within(dialog).getByLabelText('Cardholder name'), 'Jane Doe')
    await user.click(within(dialog).getByRole('button', { name: 'Add card' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('•••• •••• •••• 0005')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Payment method added.')
  })

  it('setting a non-default card as default swaps the badge', async () => {
    const user = userEvent.setup()
    render(<SubscriptionPage />)
    await goToPaymentTab(user)

    await user.click(screen.getByRole('button', { name: 'Set Mastercard ending 8210 as default' }))

    expect(screen.getByRole('status')).toHaveTextContent('Default payment method updated.')
    expect(screen.getAllByText('Default')).toHaveLength(1)
  })

  it('the last remaining card cannot be removed', async () => {
    const user = userEvent.setup()
    render(<SubscriptionPage />)
    await goToPaymentTab(user)

    await user.click(screen.getByRole('button', { name: 'Remove Mastercard ending 8210' }))
    await user.click(screen.getByRole('button', { name: 'Confirm remove card' }))

    expect(screen.getByRole('button', { name: 'Remove Visa ending 4242' })).toBeDisabled()
  })

  it('removing a card opens a confirmation and removes it on confirm', async () => {
    const user = userEvent.setup()
    render(<SubscriptionPage />)
    await goToPaymentTab(user)

    await user.click(screen.getByRole('button', { name: 'Remove Mastercard ending 8210' }))
    const dialog = screen.getByRole('dialog', { name: 'Remove this card?' })
    await user.click(within(dialog).getByRole('button', { name: 'Confirm remove card' }))

    expect(screen.queryByText('•••• •••• •••• 8210')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Payment method removed.')
  })

  it('editing billing details updates the displayed contact', async () => {
    const user = userEvent.setup()
    render(<SubscriptionPage />)
    await goToPaymentTab(user)

    await user.click(screen.getByRole('button', { name: 'Edit billing details' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit Billing Details' })

    const emailField = within(dialog).getByLabelText('Billing contact email')
    await user.clear(emailField)
    await user.type(emailField, 'new-billing@acme-crm.com')
    await user.click(within(dialog).getByRole('button', { name: 'Save billing details' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('new-billing@acme-crm.com')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Billing details updated.')
  })
})
