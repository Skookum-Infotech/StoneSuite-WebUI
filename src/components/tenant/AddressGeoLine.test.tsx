import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/services/lookupService', () => ({
  lookupService: { getCrmLookups: vi.fn() },
}))
vi.mock('@/store/useAuthStore', () => ({ isPortalSession: vi.fn() }))

import { AddressGeoLine } from './AddressGeoLine'
import { lookupService } from '@/services/lookupService'
import { isPortalSession } from '@/store/useAuthStore'

const LOOKUPS = {
  countries: [{ id: 1, code: 'US', name: 'United States' }],
  states: [{ id: 10, code: 'AR', name: 'Arkansas', countryId: 1 }],
}

function renderLine(props: { stateId?: number | null; countryId?: number | null }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AddressGeoLine {...props} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(isPortalSession).mockReturnValue(false)
  vi.mocked(lookupService.getCrmLookups).mockResolvedValue(LOOKUPS as never)
})

describe('AddressGeoLine', () => {
  it('shows state and country with their flags', async () => {
    const { container } = renderLine({ stateId: 10, countryId: 1 })
    expect(await screen.findByText('Arkansas')).toBeInTheDocument()
    expect(screen.getByText('United States')).toBeInTheDocument()
    expect(container.querySelector('img[src="/flags/states/AR.svg"]')).not.toBeNull()
    expect(container.querySelector('img[data-flag-code="us"]')).not.toBeNull()
  })

  it('shows only the part that is present', async () => {
    renderLine({ stateId: null, countryId: 1 })
    expect(await screen.findByText('United States')).toBeInTheDocument()
    expect(screen.queryByText('Arkansas')).toBeNull()
  })

  it.each([
    { name: 'no ids', props: {} },
    { name: 'unknown ids', props: { stateId: 99, countryId: 99 } },
  ])('renders nothing for $name', async ({ props }) => {
    const { container } = renderLine(props)
    await vi.waitFor(() => expect(lookupService.getCrmLookups).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('never requests lookups for a portal session', () => {
    vi.mocked(isPortalSession).mockReturnValue(true)
    const { container } = renderLine({ stateId: 10, countryId: 1 })
    expect(lookupService.getCrmLookups).not.toHaveBeenCalled()
    expect(container).toBeEmptyDOMElement()
  })
})
