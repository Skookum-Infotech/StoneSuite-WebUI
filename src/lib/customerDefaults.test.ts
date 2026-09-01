import { describe, it, expect } from 'vitest'
import { customerCoreDefaults, customerDefaultFields } from './customerDefaults'
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
    })
  })

  it('leaves a field undefined when the customer record has nothing set', () => {
    expect(customerCoreDefaults({ customer_currency: null })).toEqual({
      currencyId: undefined,
      salesTaxPercent: undefined,
      paymentTermsId: undefined,
      priceLevelId: undefined,
    })
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
    }
    expect(customerDefaultFields(customer)).toEqual({
      currency_id: '3',
      sales_tax_pct: '8.25',
      payment_terms: '2',
      price_level: '1',
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
