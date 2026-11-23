import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PasswordStrengthMeter } from './PasswordStrengthMeter'

describe('PasswordStrengthMeter', () => {
  it('renders nothing until something is typed', () => {
    const { container } = render(<PasswordStrengthMeter password="" />)
    expect(container).toBeEmptyDOMElement()
  })

  const cases = [
    { password: 'abc', label: 'Weak' },
    { password: 'Abcdefgh', label: 'Fair' },
    { password: 'Abcdefg1', label: 'Good' },
    { password: 'Abcdef1!', label: 'Strong' },
  ]

  it.each(cases)('labels "$password" as $label', ({ password, label }) => {
    render(<PasswordStrengthMeter password={password} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})
