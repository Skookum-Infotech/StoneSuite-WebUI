import { describe, it, expect } from 'vitest'
import { primaryAddressFields } from './crmFields'

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
