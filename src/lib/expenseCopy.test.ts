import { describe, it, expect } from 'vitest'
import { fromExpenseForCopy } from './expenseCopy'
import type { Expense } from '@/types/expense'

const expense = {
  expenseNumber: 'EXP-6', status: 'Approved', department: 'Sales', memo: 'Client dinner',
  customFields: { project: 'P1' },
  items: [
    { lineNumber: 1, categoryCode: 'MEAL', categoryName: 'Meals', expenseDate: '2020-01-05', amount: 80, description: 'Dinner' },
    { lineNumber: 2, categoryCode: 'TRVL', categoryName: 'Travel', expenseDate: '2020-01-06', amount: 20 },
  ],
} as unknown as Expense

describe('fromExpenseForCopy', () => {
  const copy = fromExpenseForCopy(expense)

  it.each([
    ['exp_doc_num', ''],
    ['exp_status', 'Draft'],
  ])('resets %s', (key, expected) => {
    expect(copy.data[key]).toBe(expected)
  })

  it.each([
    ['department', 'Sales'],
    ['memo', 'Client dinner'],
  ])('keeps %s', (key, expected) => {
    expect(copy.data[key]).toBe(expected)
  })

  it('keeps each line but blanks its date so it must be chosen again', () => {
    expect(copy.customFieldValues).toEqual({ project: 'P1' })
    expect(copy.lineItems).toHaveLength(2)
    expect(copy.lineItems[0]).toMatchObject({ categoryCode: 'MEAL', amount: '80', description: 'Dinner' })
    expect(copy.lineItems.map((l) => l.expenseDate)).toEqual(['', ''])
  })
})
