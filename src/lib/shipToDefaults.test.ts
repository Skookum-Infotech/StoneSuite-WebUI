import { describe, it, expect } from 'vitest'
import { shipSameAsBillFields } from './shipToDefaults'

describe('shipSameAsBillFields', () => {
  const bill = {
    bill_attn: 'Jane Smith',
    bill_address1: '456 Commerce Blvd',
    bill_address2: 'Floor 2',
    bill_suite: 'Suite 200',
    bill_city: 'Chicago',
    bill_country: '1',
    bill_state: '17',
    bill_zip: '60601',
    bill_phone: '+1 (555) 123-4567',
    bill_fax: '+1 (555) 111-2222',
    bill_email: 'accounts@acme.com',
  }

  it('copies every bill_* field onto its ship_* equivalent', () => {
    expect(shipSameAsBillFields(bill)).toEqual({
      ship_attn: 'Jane Smith',
      ship_address1: '456 Commerce Blvd',
      ship_address2: 'Floor 2',
      ship_suite: 'Suite 200',
      ship_city: 'Chicago',
      ship_country: '1',
      ship_state: '17',
      ship_zip: '60601',
      ship_phone: '+1 (555) 123-4567',
      ship_fax: '+1 (555) 111-2222',
      ship_email: 'accounts@acme.com',
    })
  })

  it('defaults a missing bill_* field to an empty string', () => {
    expect(shipSameAsBillFields({})).toEqual({
      ship_attn: '', ship_address1: '', ship_address2: '', ship_suite: '',
      ship_city: '', ship_country: '', ship_state: '', ship_zip: '',
      ship_phone: '', ship_fax: '', ship_email: '',
    })
  })

  it('includes ship_customer from the billing customer name when provided', () => {
    expect(shipSameAsBillFields({}, 'Acme Co').ship_customer).toBe('Acme Co')
  })

  it('omits ship_customer when no customer name is provided', () => {
    expect(shipSameAsBillFields({})).not.toHaveProperty('ship_customer')
  })
})
