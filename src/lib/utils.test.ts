import { describe, it, expect } from 'vitest'
import { cn, CUSTOM_FONT_SIZES } from './utils'

describe('cn', () => {
  // Each custom size must survive next to a text color: tailwind-merge drops
  // unknown `text-*` classes as conflicting colors unless they are registered.
  it.each(CUSTOM_FONT_SIZES.map((size) => [size]))('keeps text-%s next to a text color', (size) => {
    expect(cn(`text-${size}`, 'text-ink')).toBe(`text-${size} text-ink`)
  })

  it.each([
    ['text-button', 'text-body', 'text-body'],
    ['text-ink', 'text-ink-strong', 'text-ink-strong'],
  ])('lets a later %s win over %s', (first, second, expected) => {
    expect(cn(first, second)).toBe(expected)
  })
})
