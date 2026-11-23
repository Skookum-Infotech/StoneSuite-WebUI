import { describe, it, expect } from 'vitest'
import { applyAddressMirroring, primaryAddressFields } from './crmFields'

describe('primaryAddressFields', () => {
  const primary = {
    customer_addr_line1: '123 Main Street',
    customer_addr_line2: 'Building B',
    customer_addr_suitenum: 'Suite 400',
    customer_addr_city: 'New York',
    customer_addr_country: '1',
    customer_addr_state: '36',
    customer_addr_zip: '10001',
  }

  it('copies the primary address onto the billing address keys', () => {
    expect(primaryAddressFields(primary, 'bill')).toEqual({
      customer_bill_addr_line1: '123 Main Street',
      customer_bill_addr_line2: 'Building B',
      customer_bill_addr_suitenum: 'Suite 400',
      customer_bill_addr_city: 'New York',
      customer_bill_addr_country: '1',
      customer_bill_addr_state: '36',
      customer_bill_addr_zip: '10001',
    })
  })

  it('copies the primary address onto the shipping address keys', () => {
    expect(primaryAddressFields(primary, 'ship')).toEqual({
      customer_ship_addr_line1: '123 Main Street',
      customer_ship_addr_line2: 'Building B',
      customer_ship_addr_suitenum: 'Suite 400',
      customer_ship_addr_city: 'New York',
      customer_ship_addr_country: '1',
      customer_ship_addr_state: '36',
      customer_ship_addr_zip: '10001',
    })
  })

  it('defaults a missing primary field to an empty string', () => {
    expect(primaryAddressFields({}, 'bill')).toEqual({
      customer_bill_addr_line1: '', customer_bill_addr_line2: '', customer_bill_addr_suitenum: '',
      customer_bill_addr_city: '', customer_bill_addr_country: '', customer_bill_addr_state: '',
      customer_bill_addr_zip: '',
    })
  })
})

describe('applyAddressMirroring', () => {
  const base = {
    customer_is_bill_as_primary: true,
    customer_is_ship_as_primary: false,
    customer_addr_city: 'Chicago',
    customer_bill_addr_city: 'Chicago',
    customer_ship_addr_city: 'Dallas',
  }

  it('re-copies to billing when a primary field changes while the flag is on', () => {
    const next = applyAddressMirroring(base, 'customer_addr_city', 'Boston')
    expect(next.customer_bill_addr_city).toBe('Boston')
  })

  it('leaves shipping untouched while its flag is off', () => {
    const next = applyAddressMirroring(base, 'customer_addr_city', 'Boston')
    expect(next.customer_ship_addr_city).toBe('Dallas')
  })

  it('copies on ticking the flag', () => {
    const next = applyAddressMirroring(base, 'customer_is_ship_as_primary', true)
    expect(next.customer_ship_addr_city).toBe('Chicago')
  })

  it('does not overwrite billing when the flag is off', () => {
    const next = applyAddressMirroring({ ...base, customer_is_bill_as_primary: false }, 'customer_addr_city', 'Boston')
    expect(next.customer_bill_addr_city).toBe('Chicago')
  })
})
