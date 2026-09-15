import { describe, it, expect } from 'vitest'
import { customerCoreDefaults, customerDefaultFields, BILL_ADDRESS_KEYS } from './customerDefaults'
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
