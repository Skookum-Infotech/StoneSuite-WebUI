import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Select } from './select'

describe('Select flags', () => {
  it('shows a state flag beside the selected value and each option', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Select value="2" onChange={() => undefined} aria-label="State">
        <option value="">— Select —</option>
        <option value="1" data-flag="state:AL">Alabama</option>
        <option value="2" data-flag="state:AR">Arkansas</option>
      </Select>,
    )

    expect(container.querySelector('img[src="/flags/states/AR.svg"]')).not.toBeNull()

    await user.click(screen.getByRole('combobox', { name: 'State' }))
    const list = screen.getByRole('listbox', { name: 'State' })
    expect(list.querySelector('img[src="/flags/states/AL.svg"]')).not.toBeNull()
    expect(within(list).getByRole('option', { name: /Arkansas/ })).toBeInTheDocument()
  })

  it('shows a country flag from an alpha-2 or alpha-3 code', async () => {
    const user = userEvent.setup()
    render(
      <Select value="" onChange={() => undefined} aria-label="Country">
        <option value="">— Select —</option>
        <option value="1" data-flag="country:US">United States</option>
        <option value="2" data-flag="country:GBR">United Kingdom</option>
      </Select>,
    )

    await user.click(screen.getByRole('combobox', { name: 'Country' }))
    const list = screen.getByRole('listbox', { name: 'Country' })
    expect(list.querySelector('img[data-flag-code="us"]')).not.toBeNull()
    expect(list.querySelector('img[data-flag-code="gb"]')).not.toBeNull()
  })

  it('renders plain options unchanged when no flag is given', async () => {
    const user = userEvent.setup()
    render(
      <Select value="" onChange={() => undefined} aria-label="Terms">
        <option value="">— Select —</option>
        <option value="1">Net 30</option>
      </Select>,
    )
    await user.click(screen.getByRole('combobox', { name: 'Terms' }))
    expect(screen.getByRole('listbox', { name: 'Terms' }).querySelector('img, .fi')).toBeNull()
  })
})
