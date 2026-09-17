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

  // Billing address fields are unconditionally required now (no more
  // showIfFieldFalse-driven exemption) — the fields stay visible when
  // "Billing Same as Primary" is checked (disabledIfFieldTrue) and the app
  // populates them via primaryAddressFields(), rather than the old
  // hide-and-skip-validation behavior.
  it('flags missing billing address fields even when billing is same as primary', () => {
    const coreFields = { ...withPrimaryAddress, customer_is_bill_as_primary: true }
    const keys = validateCrmRecord(coreFields, [], {}).map((e) => e.key)
    expect(keys).toEqual(expect.arrayContaining(['customer_bill_addr_line1', 'customer_bill_addr_city']))
  })

  it('flags missing billing address fields when billing is not same as primary', () => {
    const coreFields = { ...withPrimaryAddress, customer_is_bill_as_primary: false }
    const keys = validateCrmRecord(coreFields, [], {}).map((e) => e.key)
    expect(keys).toEqual(expect.arrayContaining([
      'customer_bill_addr_line1', 'customer_bill_addr_city', 'customer_bill_addr_country',
      'customer_bill_addr_state', 'customer_bill_addr_zip',
    ]))
  })

  it('passes with no errors once every required core field is filled, including a mirrored billing address', () => {
    const coreFields = {
      ...withPrimaryAddress,
      customer_is_bill_as_primary: true,
      customer_bill_addr_line1: withPrimaryAddress.customer_addr_line1,
      customer_bill_addr_city: withPrimaryAddress.customer_addr_city,
      customer_bill_addr_country: withPrimaryAddress.customer_addr_country,
      customer_bill_addr_state: withPrimaryAddress.customer_addr_state,
      customer_bill_addr_zip: withPrimaryAddress.customer_addr_zip,
    }
    expect(validateCrmRecord(coreFields, [], {})).toEqual([])
  })
})

// customer_sales_tax_percent (min 0, max 100), customer_lead_score (min 0,
// max 100), customer_expected_deal_value / customer_credit_limit (min 0, no
// max) are the four `type: 'number'` core fields declared in crmFields.ts —
// none of them are `required`, so these cases isolate the range check from
// the missing-value check above.
describe('validateCrmRecord — numeric core field ranges', () => {
  it('flags a percent field below its minimum', () => {
    const errors = validateCrmRecord({ customer_sales_tax_percent: -5 }, [], {})
    expect(errors).toContainEqual({ key: 'customer_sales_tax_percent', label: 'Sales Tax %' })
  })

  it('flags a percent field above its maximum', () => {
    const errors = validateCrmRecord({ customer_sales_tax_percent: 150 }, [], {})
    expect(errors).toContainEqual({ key: 'customer_sales_tax_percent', label: 'Sales Tax %' })
  })

  it('does not flag a percent field within range', () => {
    const errors = validateCrmRecord({ customer_sales_tax_percent: 8.25 }, [], {})
    expect(errors.find((e) => e.key === 'customer_sales_tax_percent')).toBeUndefined()
  })

  it('does not flag an empty, non-required number field', () => {
    const errors = validateCrmRecord({ customer_sales_tax_percent: '' }, [], {})
    expect(errors.find((e) => e.key === 'customer_sales_tax_percent')).toBeUndefined()
  })

  it('flags a negative value on a min-only field (no declared max)', () => {
    const errors = validateCrmRecord({ customer_credit_limit: -100 }, [], {})
    expect(errors).toContainEqual({ key: 'customer_credit_limit', label: 'Credit Limit' })
  })

  it('does not flag a large positive value on a min-only field', () => {
    const errors = validateCrmRecord({ customer_credit_limit: 5_000_000 }, [], {})
    expect(errors.find((e) => e.key === 'customer_credit_limit')).toBeUndefined()
  })

  it('flags a non-numeric string that reached a number field', () => {
    const errors = validateCrmRecord({ customer_lead_score: 'abc' }, [], {})
    expect(errors).toContainEqual({ key: 'customer_lead_score', label: 'Lead Score' })
  })
})
