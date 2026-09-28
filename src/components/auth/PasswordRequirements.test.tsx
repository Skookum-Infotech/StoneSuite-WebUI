import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PASSWORD_RULES } from '@/lib/passwordPolicy'
import { PasswordRequirements } from './PasswordRequirements'

const item = (label: string) => screen.getByText(label).closest('li')

describe('PasswordRequirements', () => {
  it('lists every rule in the policy', () => {
    render(<PasswordRequirements password="" />)
    expect(screen.getAllByRole('listitem')).toHaveLength(PASSWORD_RULES.length)
    for (const rule of PASSWORD_RULES) {
      expect(screen.getByText(rule.label)).toBeInTheDocument()
    }
  })

  it('shows every rule as not met before anything is typed', () => {
    render(<PasswordRequirements password="" />)
    for (const rule of PASSWORD_RULES) {
      expect(item(rule.label)).toHaveTextContent(`${rule.label} (not met)`)
    }
  })

  it('marks a rule as met once the password satisfies it, leaving the rest unmet', () => {
    render(<PasswordRequirements password="abcdefgh" />)
    expect(item('At least 8 characters')).toHaveTextContent('At least 8 characters (met)')
    expect(item('One lowercase letter')).toHaveTextContent('One lowercase letter (met)')
    expect(item('One uppercase letter')).toHaveTextContent('One uppercase letter (not met)')
    expect(item('One number')).toHaveTextContent('One number (not met)')
    expect(item('One special character (e.g. ! @ # $ %)')).toHaveTextContent('(not met)')
  })

  it('shows every rule as met for a strong password', () => {
    render(<PasswordRequirements password="Abcdef1!" />)
    for (const rule of PASSWORD_RULES) {
      expect(item(rule.label)).toHaveTextContent(`${rule.label} (met)`)
    }
  })
})
