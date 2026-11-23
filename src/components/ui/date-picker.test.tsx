import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DatePicker } from './date-picker'

describe('DatePicker', () => {
  it('shows a placeholder when no value is set', () => {
    render(<DatePicker value="" onChange={vi.fn()} label="Estimate Date" />)
    expect(screen.getByRole('button', { name: 'Estimate Date' })).toHaveTextContent('Select date')
  })

  it('shows the formatted date when a value is set', () => {
    render(<DatePicker value="2026-08-19" onChange={vi.fn()} label="Estimate Date" />)
    expect(screen.getByRole('button', { name: 'Estimate Date' })).toHaveTextContent('Aug 19, 2026')
  })

  it('opens a calendar grid when the trigger is clicked', async () => {
    const user = userEvent.setup()
    render(<DatePicker value="2026-08-19" onChange={vi.fn()} label="Estimate Date" />)

    await user.click(screen.getByRole('button', { name: 'Estimate Date' }))

    expect(screen.getByRole('grid')).toBeInTheDocument()
    expect(screen.getByRole('gridcell', { name: '19' })).toBeInTheDocument()
  })

  it('fires onChange with the ISO date when a day is picked, and closes the calendar', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DatePicker value="2026-08-19" onChange={onChange} label="Estimate Date" />)

    await user.click(screen.getByRole('button', { name: 'Estimate Date' }))
    await user.click(screen.getByRole('gridcell', { name: '25' }).querySelector('button')!)

    expect(onChange).toHaveBeenCalledWith('2026-08-25')
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  })

  it('disables the days before minDate and keeps minDate itself pickable', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DatePicker value="2026-08-19" onChange={onChange} label="Install Date" minDate="2026-08-19" />)

    await user.click(screen.getByRole('button', { name: 'Install Date' }))

    const dayButton = (name: string) => {
      const button = screen.getByRole('gridcell', { name }).querySelector('button')
      if (!button) throw new Error(`no day button for ${name}`)
      return button
    }
    expect(dayButton('18')).toBeDisabled()
    expect(dayButton('10')).toBeDisabled()
    expect(dayButton('19')).toBeEnabled()
    expect(dayButton('20')).toBeEnabled()

    await user.click(dayButton('18'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('opens on the month of minDate when nothing is selected', async () => {
    const user = userEvent.setup()
    render(<DatePicker value="" onChange={vi.fn()} label="Install Date" minDate="2026-11-10" />)

    await user.click(screen.getByRole('button', { name: 'Install Date' }))

    expect(screen.getByText('November 2026')).toBeInTheDocument()
  })

  it('does not open when disabled', async () => {
    const user = userEvent.setup()
    render(<DatePicker value="" onChange={vi.fn()} label="Estimate Date" disabled />)

    await user.click(screen.getByRole('button', { name: 'Estimate Date' }))

    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  })
})
