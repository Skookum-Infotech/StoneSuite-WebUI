import { describe, it, expect } from 'vitest'
import {
  checkPaymentAgainstInvoices, capApplicationsToBalance, creditMemoExcessAmount,
  pendingInvoiceLine, applicationsForConfirmedExcess,
  type AppliedInvoiceLine,
} from './paymentExcess'

function line(overrides: Partial<AppliedInvoiceLine> = {}): AppliedInvoiceLine {
  return { invoiceUuid: 'inv-1', invoiceNumber: 'INV-000001', balanceDue: 600, amount: 600, ...overrides }
}

describe('checkPaymentAgainstInvoices', () => {
  it.each([
    ['no application rows are never compared', 1000, [], 0, 0],
    ['payment above the balance', 1000, [line()], 400, 600],
    ['payment equal to the balance', 600, [line()], 0, 600],
    ['payment below the balance', 500, [line()], 0, 600],
    ['payment above the balance with a partial application', 1000, [line({ amount: 300 })], 400, 600],
    ['payment above the summed balances of two invoices', 1000, [
      line(),
      line({ invoiceUuid: 'inv-2', invoiceNumber: 'INV-000002', balanceDue: 300, amount: 300 }),
    ], 100, 900],
    ['floating point noise is not an excess', 0.3, [line({ balanceDue: 0.1, amount: 0.1 }), line({ invoiceUuid: 'inv-2', balanceDue: 0.2, amount: 0.2 })], 0, 0.3],
    ['an empty payment amount is never an excess', Number.NaN, [line()], 0, 600],
  ])('%s', (_name, paymentAmount, lines, excessAmount, balanceTotal) => {
    const result = checkPaymentAgainstInvoices(paymentAmount, lines)
    expect(result.excessAmount).toBe(excessAmount)
    expect(result.balanceTotal).toBe(balanceTotal)
  })

  it.each([
    ['the payment amount when it is the larger', 1000, 600, 1000, 400],
    ['the applied total when the application was raised above the payment amount', 600, 1500, 1500, 900],
  ])('treats %s as the amount entered', (_name, paymentAmount, applied, enteredAmount, excessAmount) => {
    const result = checkPaymentAgainstInvoices(paymentAmount, [line({ amount: applied })])
    expect(result.enteredAmount).toBe(enteredAmount)
    expect(result.excessAmount).toBe(excessAmount)
  })

  it('lists application rows that exceed their own invoice balance', () => {
    const over = line({ amount: 1000 })
    expect(checkPaymentAgainstInvoices(1000, [over]).overBalanceLines).toEqual([over])
  })

  it('flags an over-balance row even when the payment itself has no excess', () => {
    const tooMuch = line({ amount: 800 })
    const fine = line({ invoiceUuid: 'inv-2', invoiceNumber: 'INV-000002', balanceDue: 300, amount: 100 })
    const result = checkPaymentAgainstInvoices(900, [tooMuch, fine])
    expect(result.excessAmount).toBe(0)
    expect(result.overBalanceLines).toEqual([tooMuch])
  })

  it('does not flag rows that are within their balance', () => {
    expect(checkPaymentAgainstInvoices(1000, [line({ amount: 600 })]).overBalanceLines).toEqual([])
  })
})

describe('capApplicationsToBalance', () => {
  it('caps every application to its invoice balance and leaves unknown invoices alone', () => {
    const applications = [
      { invoiceUuid: 'inv-1', amount: 1000 },
      { invoiceUuid: 'inv-2', amount: 50 },
      { invoiceUuid: 'inv-3', amount: 75 },
    ]
    const lines = [line(), line({ invoiceUuid: 'inv-2', balanceDue: 300, amount: 50 })]
    expect(capApplicationsToBalance(applications, lines)).toEqual([
      { invoiceUuid: 'inv-1', amount: 600 },
      { invoiceUuid: 'inv-2', amount: 50 },
      { invoiceUuid: 'inv-3', amount: 75 },
    ])
  })

  it('does not mutate the input', () => {
    const applications = [{ invoiceUuid: 'inv-1', amount: 1000 }]
    capApplicationsToBalance(applications, [line()])
    expect(applications).toEqual([{ invoiceUuid: 'inv-1', amount: 1000 }])
  })
})

describe('creditMemoExcessAmount', () => {
  it.each([
    ['the server unapplied balance covers the excess', 400, 700, 400],
    ['the server unapplied balance is smaller than the excess', 400, 250, 250],
    ['the server reports nothing unapplied', 400, 0, 0],
    ['the server value is missing', 400, undefined, 0],
    ['the server value is not a number', 400, Number.NaN, 0],
  ])('%s', (_name, excess, unapplied, expected) => {
    expect(creditMemoExcessAmount(excess, unapplied)).toBe(expected)
  })
})

describe('pendingInvoiceLine', () => {
  const pending = { id: 'inv-1', number: 'INV-000001', balanceDue: 1000 }

  it.each([
    ['nothing is selected', null, Number.NaN, 1500, [], null],
    ['the invoice is already an application row', pending, Number.NaN, 1500, [line()], null],
  ])('returns null when %s', (_name, selected, typed, paymentAmount, lines, expected) => {
    expect(pendingInvoiceLine(selected, typed, paymentAmount, lines)).toBe(expected)
  })

  it.each([
    ['uses the amount typed but not yet added', 1500, 1000, 1500],
    ['falls back to the payment amount when it is below the balance', Number.NaN, 400, 400],
    ['falls back to the balance when the payment is above it', Number.NaN, 1500, 1000],
    ['falls back to the balance when the payment amount is empty', 0, Number.NaN, 1000],
  ])('%s', (_name, typed, paymentAmount, amount) => {
    expect(pendingInvoiceLine(pending, typed, paymentAmount, [])).toEqual({
      invoiceUuid: 'inv-1', invoiceNumber: 'INV-000001', balanceDue: 1000, amount,
    })
  })
})

describe('applicationsForConfirmedExcess', () => {
  it('caps existing applications and appends selected invoices that were never added', () => {
    const applications = [{ invoiceUuid: 'inv-1', amount: 1000 }]
    const lines = [
      line(),
      line({ invoiceUuid: 'inv-2', balanceDue: 300, amount: 1500 }),
    ]
    expect(applicationsForConfirmedExcess(applications, lines)).toEqual([
      { invoiceUuid: 'inv-1', amount: 600 },
      { invoiceUuid: 'inv-2', amount: 300 },
    ])
  })

  it('appends an un-added invoice at less than its balance when that is all that was entered', () => {
    expect(applicationsForConfirmedExcess([], [line({ amount: 400 })])).toEqual([
      { invoiceUuid: 'inv-1', amount: 400 },
    ])
  })
})
