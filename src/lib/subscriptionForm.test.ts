import { describe, it, expect } from 'vitest'
import {
  newFeatures, cardBrandFromNumber, cardLast4, toPaymentMethodInput,
  contactSalesSchema, addPaymentMethodSchema, billingContactSchema,
} from './subscriptionForm'
import type { PlanTier } from '@/types/subscription'

const starter: PlanTier = {
  id: 'starter',
  name: 'Starter',
  pricePerMonth: 19,
  pricePerYear: 190,
  features: ['Up to 3 users', 'Core CRM workflows', 'Standard email support'],
  highlighted: false,
}

const pro: PlanTier = {
  id: 'pro',
  name: 'Pro',
  pricePerMonth: 49,
  pricePerYear: 490,
  features: ['Up to 15 users', 'Core CRM workflows', 'Custom fields', 'Priority support'],
  highlighted: true,
}

describe('newFeatures', () => {
  it('returns only features on the target plan not present on the current plan', () => {
    expect(newFeatures(starter, pro)).toEqual(['Up to 15 users', 'Custom fields', 'Priority support'])
  })

  it('returns an empty array when target has no features beyond current', () => {
    expect(newFeatures(pro, pro)).toEqual([])
  })

  it('returns features the target has that the source lacks, even for a downgrade direction', () => {
    expect(newFeatures(pro, starter)).toEqual(['Up to 3 users', 'Standard email support'])
  })

  it('returns an empty array for identical plans', () => {
    expect(newFeatures(starter, starter)).toEqual([])
  })
})

describe('cardBrandFromNumber', () => {
  it.each([
    ['4242424242424242', 'Visa'],
    ['4111111111111111', 'Visa'],
    ['5555555555554444', 'Mastercard'],
    ['2223003122003222', 'Mastercard'],
    ['378282246310005', 'Amex'],
    ['371449635398431', 'Amex'],
    ['6011111111111117', 'Visa'], // unrecognized prefix (Discover) falls back to Visa
    ['', 'Visa'],
  ])('cardBrandFromNumber(%p) -> %p', (input, expected) => {
    expect(cardBrandFromNumber(input)).toBe(expected)
  })

  it('ignores non-digit formatting characters', () => {
    expect(cardBrandFromNumber('4242 4242 4242 4242')).toBe('Visa')
  })
})

describe('cardLast4', () => {
  it.each([
    ['4242424242424242', '4242'],
    ['4242 4242 4242 4242', '4242'],
    ['123', ''],
    ['', ''],
  ])('cardLast4(%p) -> %p', (input, expected) => {
    expect(cardLast4(input)).toBe(expected)
  })
})

describe('toPaymentMethodInput', () => {
  it('derives brand, last4, and passes expiry through unchanged', () => {
    expect(toPaymentMethodInput({ cardNumber: '4242424242424242', expiry: '12/29' })).toEqual({
      brand: 'Visa',
      last4: '4242',
      expiry: '12/29',
    })
  })
})

describe('contactSalesSchema', () => {
  const valid = { name: 'Jane Doe', workEmail: 'jane@acme.com', companySize: 'medium' as const, message: '' }

  it('accepts a valid submission', () => {
    expect(contactSalesSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts a missing optional message', () => {
    const { message: _message, ...rest } = valid
    expect(contactSalesSchema.safeParse(rest).success).toBe(true)
  })

  it.each([
    ['name', ''],
    ['workEmail', ''],
    ['workEmail', 'not-an-email'],
  ])('rejects an invalid %s', (field, value) => {
    const result = contactSalesSchema.safeParse({ ...valid, [field]: value })
    expect(result.success).toBe(false)
  })

  it('rejects an unrecognized company size', () => {
    const result = contactSalesSchema.safeParse({ ...valid, companySize: 'huge' })
    expect(result.success).toBe(false)
  })
})

describe('addPaymentMethodSchema', () => {
  const valid = { cardNumber: '4242424242424242', expiry: '12/99', cvc: '123', cardholderName: 'Jane Doe' }

  it('accepts a valid card', () => {
    expect(addPaymentMethodSchema.safeParse(valid).success).toBe(true)
  })

  it.each([
    ['cardNumber', '123'],
    ['expiry', '13/99'],
    ['expiry', '2099'],
    ['expiry', '01/20'],
    ['cvc', '12'],
    ['cardholderName', ''],
  ])('rejects an invalid %s', (field, value) => {
    const result = addPaymentMethodSchema.safeParse({ ...valid, [field]: value })
    expect(result.success).toBe(false)
  })
})

describe('billingContactSchema', () => {
  const valid = {
    name: 'Jane Doe',
    email: 'jane@acme.com',
    addressLine1: '123 Main St',
    city: 'Springfield',
    state: 'IL',
    postalCode: '62704',
    country: 'USA',
  }

  it('accepts a valid billing contact', () => {
    expect(billingContactSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts an optional addressLine2', () => {
    expect(billingContactSchema.safeParse({ ...valid, addressLine2: 'Suite 400' }).success).toBe(true)
  })

  it.each(['name', 'email', 'addressLine1', 'city', 'state', 'postalCode', 'country'])(
    'rejects a missing %s',
    (field) => {
      const result = billingContactSchema.safeParse({ ...valid, [field]: '' })
      expect(result.success).toBe(false)
    },
  )
})
