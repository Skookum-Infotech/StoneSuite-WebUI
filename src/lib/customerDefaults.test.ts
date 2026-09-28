import { describe, it, expect } from 'vitest'
import {
  customerCoreDefaults, customerDefaultFields, customerShipToFields, customerRefFromRecord,
  mergeCustomerDefaults, BILL_ADDRESS_KEYS, SHIP_ADDRESS_KEYS,
} from './customerDefaults'
import type { CustomerRef } from '@/pages/sales/components/CustomerPicker'

describe('customerCoreDefaults', () => {
  it('extracts every customer_* default field from coreFields', () => {
    expect(customerCoreDefaults({
      customer_currency: 3,
      customer_sales_tax_percent: '8.25',
      customer_payment_terms: 2,
      customer_price_level: 1,
    })).toEqual({
      currencyId: '3',
      salesTaxPercent: '8.25',
      paymentTermsId: '2',
      priceLevelId: '1',
      billAttn: undefined,
      billAddress1: undefined,
      billAddress2: undefined,
      billSuite: undefined,
      billCity: undefined,
      billStateId: undefined,
      billCountryId: undefined,
      billZip: undefined,
      billPhone: undefined,
      billFax: undefined,
      billEmail: undefined,
    })
  })

  it('leaves a field undefined when the customer record has nothing set', () => {
    expect(customerCoreDefaults({ customer_currency: null })).toEqual({
      currencyId: undefined,
      salesTaxPercent: undefined,
      paymentTermsId: undefined,
      priceLevelId: undefined,
      billAttn: undefined,
      billAddress1: undefined,
      billAddress2: undefined,
      billSuite: undefined,
      billCity: undefined,
      billStateId: undefined,
      billCountryId: undefined,
      billZip: undefined,
      billPhone: undefined,
      billFax: undefined,
      billEmail: undefined,
    })
  })

  it('derives the bill address from customer_bill_addr_* when billing is not the same as primary', () => {
    const result = customerCoreDefaults({
      customer_is_bill_as_primary: false,
      customer_bill_addr_line1: '456 Commerce Blvd',
      customer_bill_addr_line2: 'Floor 2',
      customer_bill_addr_suitenum: 'Suite 200',
      customer_bill_addr_city: 'Chicago',
      customer_bill_addr_state: 17,
      customer_bill_addr_country: 1,
      customer_bill_addr_zip: '60601',
      customer_addr_line1: '123 Main Street',
      customer_addr_city: 'New York',
    })
    expect(result).toMatchObject({
      billAddress1: '456 Commerce Blvd',
      billAddress2: 'Floor 2',
      billSuite: 'Suite 200',
      billCity: 'Chicago',
      billStateId: '17',
      billCountryId: '1',
      billZip: '60601',
    })
  })

  it('derives the bill address from customer_addr_* (primary) when billing is the same as primary', () => {
    const result = customerCoreDefaults({
      customer_is_bill_as_primary: true,
      customer_addr_line1: '123 Main Street',
      customer_addr_line2: 'Building B',
      customer_addr_suitenum: 'Suite 400',
      customer_addr_city: 'New York',
      customer_addr_state: 36,
      customer_addr_country: 1,
      customer_addr_zip: '10001',
      customer_bill_addr_line1: 'should not be used',
    })
    expect(result).toMatchObject({
      billAddress1: '123 Main Street',
      billAddress2: 'Building B',
      billSuite: 'Suite 400',
      billCity: 'New York',
      billStateId: '36',
      billCountryId: '1',
      billZip: '10001',
    })
  })

  it('joins the authorized person first/last name into billAttn', () => {
    expect(customerCoreDefaults({
      customer_authorized_person_fname: 'Jane',
      customer_authorized_person_lname: 'Smith',
    }).billAttn).toBe('Jane Smith')
  })

  it('falls back to just the first or last name when the other is blank', () => {
    expect(customerCoreDefaults({ customer_authorized_person_fname: 'Jane' }).billAttn).toBe('Jane')
    expect(customerCoreDefaults({ customer_authorized_person_lname: 'Smith' }).billAttn).toBe('Smith')
  })

  it('derives the ship address from customer_ship_addr_* when shipping is not the same as primary', () => {
    const result = customerCoreDefaults({
      customer_is_ship_as_primary: false,
      customer_ship_addr_line1: '789 Warehouse Ave',
      customer_ship_addr_line2: 'Dock 4',
      customer_ship_addr_suitenum: 'Bay 2',
      customer_ship_addr_city: 'Dallas',
      customer_ship_addr_state: 44,
      customer_ship_addr_country: 1,
      customer_ship_addr_zip: '75201',
      customer_addr_line1: '123 Main Street',
      customer_addr_city: 'New York',
    })
    expect(result).toMatchObject({
      shipAddress1: '789 Warehouse Ave',
      shipAddress2: 'Dock 4',
      shipSuite: 'Bay 2',
      shipCity: 'Dallas',
      shipStateId: '44',
      shipCountryId: '1',
      shipZip: '75201',
    })
  })

  it('derives the ship address from customer_addr_* (primary) when shipping is the same as primary', () => {
    const result = customerCoreDefaults({
      customer_is_ship_as_primary: true,
      customer_addr_line1: '123 Main Street',
      customer_addr_line2: 'Building B',
      customer_addr_suitenum: 'Suite 400',
      customer_addr_city: 'New York',
      customer_addr_state: 36,
      customer_addr_country: 1,
      customer_addr_zip: '10001',
      customer_ship_addr_line1: 'should not be used',
    })
    expect(result).toMatchObject({
      shipAddress1: '123 Main Street',
      shipAddress2: 'Building B',
      shipSuite: 'Suite 400',
      shipCity: 'New York',
      shipStateId: '36',
      shipCountryId: '1',
      shipZip: '10001',
    })
  })

  it('keeps the ship address independent of the bill address', () => {
    const result = customerCoreDefaults({
      customer_is_bill_as_primary: true,
      customer_is_ship_as_primary: false,
      customer_addr_line1: '123 Main Street',
      customer_ship_addr_line1: '789 Warehouse Ave',
    })
    expect(result.billAddress1).toBe('123 Main Street')
    expect(result.shipAddress1).toBe('789 Warehouse Ave')
  })

  it('leaves billAttn undefined when neither name is set', () => {
    expect(customerCoreDefaults({}).billAttn).toBeUndefined()
  })

  it('maps primary phone and fax to billPhone/billFax', () => {
    const result = customerCoreDefaults({
      customer_primary_phonenum: '+1 (555) 123-4567',
      customer_faxnum: '+1 (555) 111-2222',
    })
    expect(result.billPhone).toBe('+1 (555) 123-4567')
    expect(result.billFax).toBe('+1 (555) 111-2222')
  })

  it('prefers the accounting email for billEmail', () => {
    expect(customerCoreDefaults({
      customer_accounts_email: 'accounts@acme.com',
      customer_contact_email: 'contact@acme.com',
    }).billEmail).toBe('accounts@acme.com')
  })

  it('falls back to the contact email when the accounting email is blank', () => {
    expect(customerCoreDefaults({
      customer_contact_email: 'contact@acme.com',
    }).billEmail).toBe('contact@acme.com')
  })
})

describe('customerDefaultFields', () => {
  it('maps every set derived field onto its document-form key', () => {
    const customer: CustomerRef = {
      id: 'cust-1',
      name: 'Acme Co',
      currencyId: '3',
      salesTaxPercent: '8.25',
      paymentTermsId: '2',
      priceLevelId: '1',
      billAttn: 'Jane Smith',
      billAddress1: '456 Commerce Blvd',
      billAddress2: 'Floor 2',
      billSuite: 'Suite 200',
      billCity: 'Chicago',
      billStateId: '17',
      billCountryId: '1',
      billZip: '60601',
      billPhone: '+1 (555) 123-4567',
      billFax: '+1 (555) 111-2222',
      billEmail: 'accounts@acme.com',
    }
    expect(customerDefaultFields(customer)).toEqual({
      currency_id: '3',
      sales_tax_pct: '8.25',
      payment_terms: '2',
      price_level: '1',
      bill_attn: 'Jane Smith',
      bill_address1: '456 Commerce Blvd',
      bill_address2: 'Floor 2',
      bill_suite: 'Suite 200',
      bill_city: 'Chicago',
      bill_state: '17',
      bill_country: '1',
      bill_zip: '60601',
      bill_phone: '+1 (555) 123-4567',
      bill_fax: '+1 (555) 111-2222',
      bill_email: 'accounts@acme.com',
    })
  })

  it('omits keys the customer record has no value for', () => {
    const customer: CustomerRef = { id: 'cust-1', name: 'Acme Co', currencyId: '3' }
    expect(customerDefaultFields(customer)).toEqual({ currency_id: '3' })
  })

  it('returns an empty object when the customer has no derived fields set', () => {
    const customer: CustomerRef = { id: 'cust-1', name: 'Acme Co' }
    expect(customerDefaultFields(customer)).toEqual({})
  })
})

describe('BILL_ADDRESS_KEYS', () => {
  it('lists exactly the Bill To form keys that should always refresh on a new customer pick', () => {
    expect([...BILL_ADDRESS_KEYS].sort()).toEqual([
      'bill_address1', 'bill_address2', 'bill_attn', 'bill_city', 'bill_country',
      'bill_email', 'bill_fax', 'bill_phone', 'bill_state', 'bill_suite', 'bill_zip',
    ])
  })
})

describe('SHIP_ADDRESS_KEYS', () => {
  it('lists exactly the Ship To form keys that should always refresh on a new customer pick', () => {
    expect([...SHIP_ADDRESS_KEYS].sort()).toEqual([
      'ship_address1', 'ship_address2', 'ship_attn', 'ship_city', 'ship_country',
      'ship_customer', 'ship_email', 'ship_fax', 'ship_phone', 'ship_state', 'ship_suite', 'ship_zip',
    ])
  })
})

describe('customerShipToFields', () => {
  it("maps the customer's shipping address, name and contact info onto the Ship To form keys", () => {
    const customer: CustomerRef = {
      id: 'cust-1',
      name: 'Acme Co',
      billAttn: 'Jane Smith',
      billPhone: '+1 (555) 123-4567',
      billFax: '+1 (555) 111-2222',
      billEmail: 'accounts@acme.com',
      shipAddress1: '789 Warehouse Ave',
      shipAddress2: 'Dock 4',
      shipSuite: 'Bay 2',
      shipCity: 'Dallas',
      shipStateId: '44',
      shipCountryId: '1',
      shipZip: '75201',
    }
    expect(customerShipToFields(customer)).toEqual({
      ship_customer: 'Acme Co',
      ship_attn: 'Jane Smith',
      ship_address1: '789 Warehouse Ave',
      ship_address2: 'Dock 4',
      ship_suite: 'Bay 2',
      ship_city: 'Dallas',
      ship_state: '44',
      ship_country: '1',
      ship_zip: '75201',
      ship_phone: '+1 (555) 123-4567',
      ship_fax: '+1 (555) 111-2222',
      ship_email: 'accounts@acme.com',
    })
  })

  it('omits keys the customer record has no value for, but still names the shipping customer', () => {
    const customer: CustomerRef = { id: 'cust-1', name: 'Acme Co', shipCity: 'Dallas' }
    expect(customerShipToFields(customer)).toEqual({ ship_customer: 'Acme Co', ship_city: 'Dallas' })
  })
})

describe('customerRefFromRecord', () => {
  it('builds a CustomerRef from a customer CRM record, ship address included', () => {
    const ref = customerRefFromRecord({
      id: 'cust-9',
      coreFields: {
        customer_name: 'Acme Co',
        customer_currency: 3,
        customer_is_bill_as_primary: true,
        customer_addr_line1: '123 Main Street',
        customer_ship_addr_line1: '789 Warehouse Ave',
      },
    })
    expect(ref).toMatchObject({
      id: 'cust-9',
      name: 'Acme Co',
      currencyId: '3',
      billAddress1: '123 Main Street',
      shipAddress1: '789 Warehouse Ave',
    })
  })

  it('falls back to a placeholder name when the record has none', () => {
    expect(customerRefFromRecord({ id: 'cust-9', coreFields: {} }).name).toBe('(unnamed)')
  })
})

describe('mergeCustomerDefaults', () => {
  const customer: CustomerRef = {
    id: 'cust-1',
    name: 'Acme Co',
    currencyId: '3',
    paymentTermsId: '2',
    billAttn: 'Jane Smith',
    billAddress1: '456 Commerce Blvd',
    billCity: 'Chicago',
    billStateId: '17',
    billCountryId: '1',
    shipAddress1: '789 Warehouse Ave',
    shipCity: 'Dallas',
    shipStateId: '44',
    shipCountryId: '1',
  }

  it('fills terms fields only while they are still empty, so a manual override survives', () => {
    const merged = mergeCustomerDefaults({ currency_id: '9', payment_terms: '' }, customer)
    expect(merged.currency_id).toBe('9')
    expect(merged.payment_terms).toBe('2')
  })

  it('always replaces the Bill To address, even when already populated', () => {
    const merged = mergeCustomerDefaults(
      { bill_address1: 'old customer street', bill_city: 'Old City', bill_zip: '00000' },
      customer,
    )
    expect(merged).toMatchObject({
      bill_address1: '456 Commerce Blvd', bill_city: 'Chicago', bill_state: '17', bill_country: '1', bill_attn: 'Jane Smith',
    })
    // The customer has no zip, so nothing overwrites it.
    expect(merged.bill_zip).toBe('00000')
  })

  it('leaves Ship To alone unless the form has a Ship To section', () => {
    const merged = mergeCustomerDefaults({}, customer)
    expect(merged).not.toHaveProperty('ship_address1')
    expect(merged).not.toHaveProperty('ship_customer')
  })

  it("replaces the Ship To address with the customer's shipping address when asked", () => {
    const merged = mergeCustomerDefaults(
      { ship_same_as_bill: false, ship_address1: 'old customer dock', ship_city: 'Old City' },
      customer,
      { shipTo: true },
    )
    expect(merged).toMatchObject({
      ship_customer: 'Acme Co',
      ship_address1: '789 Warehouse Ave',
      ship_city: 'Dallas',
      ship_state: '44',
      ship_country: '1',
      ship_attn: 'Jane Smith',
    })
  })

  it('re-mirrors Ship To from the new Bill To, not the shipping address, while "Same as Billing" is checked', () => {
    const merged = mergeCustomerDefaults(
      { ship_same_as_bill: true, ship_address1: 'old customer street', ship_customer: 'Old Co' },
      customer,
      { shipTo: true },
    )
    expect(merged).toMatchObject({
      ship_same_as_bill: true,
      ship_customer: 'Acme Co',
      ship_address1: '456 Commerce Blvd',
      ship_city: 'Chicago',
    })
  })

  it('does not mutate the form data it is given', () => {
    const current = { bill_address1: 'old customer street' }
    mergeCustomerDefaults(current, customer, { shipTo: true })
    expect(current).toEqual({ bill_address1: 'old customer street' })
  })
})
