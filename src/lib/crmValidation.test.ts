import { describe, it, expect } from 'vitest'
import { validateCrmRecord } from './crmValidation'
import type { FieldDefinition } from '@/types/tenant'

// Domain logic: required-field validation across core + custom fields.
// Table-driven where it pays off; explicit cases where intent is clearer.
describe('validateCrmRecord — custom field requirements', () => {
  const requiredCustom: FieldDefinition[] = [
    { key: 'priority', label: 'Priority', required: true } as FieldDefinition,
  ]

  it('flags a required custom field that is empty', () => {
    const errors = validateCrmRecord({}, requiredCustom, { priority: '' })
    expect(errors).toContainEqual({ key: 'priority', label: 'Priority' })
  })

  it('does not flag a required custom field that has a value', () => {
    const errors = validateCrmRecord({}, requiredCustom, { priority: 'high' })
    expect(errors.find((e) => e.key === 'priority')).toBeUndefined()
  })

  it('ignores optional custom fields entirely', () => {
    const optional: FieldDefinition[] = [
      { key: 'note', label: 'Note', required: false } as FieldDefinition,
    ]
    const errors = validateCrmRecord({}, optional, {})
    // Required core fields may still be flagged; an optional custom field never is.
    expect(errors.find((e) => e.key === 'note')).toBeUndefined()
  })

  it.each([undefined, null, ''])('treats %p as missing', (val) => {
    const errors = validateCrmRecord({}, requiredCustom, { priority: val })
    expect(errors).toContainEqual({ key: 'priority', label: 'Priority' })
  })
})

// Exercises the real CRM_CORE_SECTIONS (via validateCrmRecord's internal
// import) rather than a mock field list — these assert the actual required
// set a Lead/Prospect/Customer record is validated against.
describe('validateCrmRecord — customer core address/contact requirements', () => {
  const nameAndEmailOnly = {
    customer_name: 'Acme Corp',
    customer_contact_email: 'contact@acme.com',
  }
  const withPrimaryAddress = {
    ...nameAndEmailOnly,
    customer_addr_line1: '123 Main St',
    customer_addr_city: 'New York',
    customer_addr_country: '1',
    customer_addr_state: '36',
    customer_addr_zip: '10001',
    customer_primary_phonenum: '+1 555 123 4567',
  }

  it('flags a missing primary address and phone on an otherwise-complete record', () => {
    const keys = validateCrmRecord(nameAndEmailOnly, [], {}).map((e) => e.key)
    expect(keys).toEqual(expect.arrayContaining([
      'customer_addr_line1', 'customer_addr_city', 'customer_addr_country',
      'customer_addr_state', 'customer_addr_zip', 'customer_primary_phonenum',
    ]))
  })

  it('does not flag billing address fields when billing is same as primary', () => {
    const coreFields = { ...withPrimaryAddress, customer_is_bill_as_primary: true }
    const keys = validateCrmRecord(coreFields, [], {}).map((e) => e.key)
    expect(keys).not.toEqual(expect.arrayContaining(['customer_bill_addr_line1', 'customer_bill_addr_city']))
  })

  it('flags missing billing address fields when billing is not same as primary', () => {
    const coreFields = { ...withPrimaryAddress, customer_is_bill_as_primary: false }
    const keys = validateCrmRecord(coreFields, [], {}).map((e) => e.key)
    expect(keys).toEqual(expect.arrayContaining([
      'customer_bill_addr_line1', 'customer_bill_addr_city', 'customer_bill_addr_country',
      'customer_bill_addr_state', 'customer_bill_addr_zip',
    ]))
  })

  it('passes with no errors once every required core field is filled', () => {
    const coreFields = { ...withPrimaryAddress, customer_is_bill_as_primary: true }
    expect(validateCrmRecord(coreFields, [], {})).toEqual([])
  })
})
