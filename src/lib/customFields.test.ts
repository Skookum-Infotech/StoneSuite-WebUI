import { describe, it, expect } from 'vitest'
import { activeCustomFields, coerceCustomFields } from './customFields'
import type { FieldDefinition, WorkflowDefinition, Workflow } from '@/types/tenant'

const baseWorkflow: Workflow = {
  id: 'wf-1',
  key: 'lead',
  name: 'Lead',
  description: '',
  enabled: true,
  isDefault: true,
  pipelineOrder: 1,
  customFieldsEnabled: false,
  approverUserIds: [],
}

const fields: FieldDefinition[] = [
  { id: 'f1', workflowId: 'wf-1', key: 'source', label: 'Source', dataType: 'string', required: false, options: [], validation: {}, sortOrder: 0 },
]

function def(overrides: Partial<Workflow>): WorkflowDefinition {
  return {
    workflow: { ...baseWorkflow, ...overrides },
    states: [],
    transitions: [],
    fields,
  }
}

// Domain logic: what "activeCustomFields" surfaces depends only on the
// workflow's customFieldsEnabled switch, not on whether definitions exist —
// definitions can persist while the section is off (see workflow/validate.go
// on the backend: disabled fields stay "known", just not required/rendered).
describe('activeCustomFields', () => {
  it('returns [] when the workflow is undefined (still loading)', () => {
    expect(activeCustomFields(undefined)).toEqual([])
  })

  it('returns [] when the section is switched off, even though definitions exist', () => {
    expect(activeCustomFields(def({ customFieldsEnabled: false }))).toEqual([])
  })

  it('returns the field definitions when the section is switched on', () => {
    expect(activeCustomFields(def({ customFieldsEnabled: true }))).toBe(fields)
  })

  it('returns [] when switched on but no definitions exist yet (fresh tenant)', () => {
    const empty = { ...def({ customFieldsEnabled: true }), fields: [] }
    expect(activeCustomFields(empty)).toEqual([])
  })
})

describe('coerceCustomFields', () => {
  const defs: FieldDefinition[] = [
    { id: 'f1', workflowId: 'wf-1', key: 'count', label: 'Count', dataType: 'number', required: false, options: [], validation: {}, sortOrder: 0 },
    { id: 'f2', workflowId: 'wf-1', key: 'active', label: 'Active', dataType: 'bool', required: false, options: [], validation: {}, sortOrder: 1 },
    { id: 'f3', workflowId: 'wf-1', key: 'note', label: 'Note', dataType: 'string', required: false, options: [], validation: {}, sortOrder: 2 },
  ]

  it('coerces a numeric string to a number', () => {
    expect(coerceCustomFields(defs, { count: '3' })).toEqual({ count: 3 })
  })

  it('coerces a truthy value to a boolean', () => {
    expect(coerceCustomFields(defs, { active: 'true' })).toEqual({ active: true })
  })

  it.each([undefined, null, ''])('drops %p values instead of coercing them', (val) => {
    expect(coerceCustomFields(defs, { note: val })).toEqual({})
  })

  it('passes non-empty strings through unchanged', () => {
    expect(coerceCustomFields(defs, { note: 'hello' })).toEqual({ note: 'hello' })
  })

  it('ignores keys with no matching field definition', () => {
    expect(coerceCustomFields(defs, { ghost: 'x' })).toEqual({})
  })
})
