import { describe, it, expect } from 'vitest'
import type { RouteObject } from 'react-router-dom'
import { formatBreadcrumbSegment, isRegisteredPath } from './breadcrumb'

// Mirrors the shape of the real table: a shell layout whose children are flat
// "group/page" paths (so "finance" itself is never a route), a param route
// with an /edit child but no bare /:id page, and a top-level catch-all.
const ROUTES: RouteObject[] = [
  {
    path: '/',
    children: [
      { path: 'dashboard' },
      { path: 'config' },
      { path: 'config/roles' },
      { path: 'config/roles/:id/edit' },
      { path: 'finance/journal-entries' },
      { path: 'finance/journal-entries/:id' },
      { path: 'inventory/:moduleKey' },
    ],
  },
  { path: '*' },
]

describe('formatBreadcrumbSegment', () => {
  it.each([
    ['crm', 'CRM'],
    ['a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Details'],
    ['estimate', 'Estimate'],
    ['invoice', 'Invoice'],
    ['new', 'New'],
    ['edit', 'Edit'],
    ['sales_order', 'Sales Order'],
    ['credit_memo', 'Credit Memo'],
    ['purchase_order', 'Purchase Order'],
    ['item_receipt', 'Item Receipt'],
    ['vendor_bill', 'Vendor Bill'],
    ['vendor_payment', 'Vendor Payment'],
    ['vendor_credit', 'Vendor Credit'],
    ['record-numbering', 'Record Numbering'],
    ['roles-access', 'Roles Access'],
  ])('formatBreadcrumbSegment(%p) -> %p', (input, expected) => {
    expect(formatBreadcrumbSegment(input)).toBe(expected)
  })
})

describe('isRegisteredPath', () => {
  it.each([
    { label: 'a page route', path: '/dashboard', expected: true },
    { label: 'a nested page route', path: '/finance/journal-entries', expected: true },
    { label: 'a param route', path: '/finance/journal-entries/a1b2c3d4', expected: true },
    { label: 'a route that also has children', path: '/config/roles', expected: true },
    { label: 'a placeholder param route', path: '/inventory/anything', expected: true },
    { label: 'a group prefix with no page of its own', path: '/finance', expected: false },
    { label: 'another group prefix', path: '/inventory', expected: false },
    { label: 'a param segment that only has an /edit child', path: '/config/roles/a1b2c3d4', expected: false },
    { label: 'a path nothing matches', path: '/nowhere/at/all', expected: false },
  ])('$label ($path) -> $expected', ({ path, expected }) => {
    expect(isRegisteredPath(ROUTES, path)).toBe(expected)
  })

  it('treats every path as unregistered when there is no route table to check', () => {
    expect(isRegisteredPath([], '/dashboard')).toBe(false)
  })
})
