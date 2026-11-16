import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import type { ReactNode } from 'react'

vi.mock('@/services/subscriptionService', () => ({
  subscriptionService: { getUsage: vi.fn() },
}))

import { UsagePanel } from './UsagePanel'
import { subscriptionService } from '@/services/subscriptionService'
import type { SubscriptionUsage } from '@/types/subscription'

const GB = 1024 ** 3

const BASE_USAGE: SubscriptionUsage = {
  periodStart: '2026-11-01',
  periodEnd: '2026-12-01',
  storage: { usedBytes: 3.42 * GB, objectCount: 12408, measuredAt: new Date().toISOString(), limitBytes: null },
  aiTokens: {
    promptTokens: 842_000,
    completionTokens: 438_000,
    totalTokens: 1_280_000,
    limitTokens: null,
    bySource: [
      { source: 'ask', totalTokens: 700_000 },
      { source: 'doc_extract', totalTokens: 301_000 },
      { source: 'route', totalTokens: 212_000 },
      { source: 'report_interpret', totalTokens: 52_000 },
      { source: 'import', totalTokens: 15_000 },
    ],
  },
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return render(<UsagePanel />, { wrapper })
}

function httpError(status: number, message?: string) {
  const headers = new AxiosHeaders()
  return new AxiosError(message ?? `HTTP ${status}`, String(status), { headers }, null, {
    status, statusText: '', headers, config: { headers }, data: message ? { message } : {},
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('UsagePanel', () => {
  it('shows storage and token usage with no limits on the current plan', async () => {
    vi.mocked(subscriptionService.getUsage).mockResolvedValue(BASE_USAGE)
    renderPanel()

    expect(await screen.findByText('3.4 GB')).toBeInTheDocument()
    expect(screen.getByText('12,408 files')).toBeInTheDocument()
    expect(screen.getByText('1.3M')).toBeInTheDocument()
    expect(screen.getByText('842K input · 438K output')).toBeInTheDocument()
    expect(screen.getByText('01 Nov – 30 Nov 2026')).toBeInTheDocument()
    expect(screen.getAllByText('No limit on your current plan')).toHaveLength(2)
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByText(/^Updated /)).toBeInTheDocument()
  })

  it('merges assistant sources into one breakdown row, largest first', async () => {
    vi.mocked(subscriptionService.getUsage).mockResolvedValue(BASE_USAGE)
    renderPanel()

    const breakdown = await screen.findByLabelText('AI tokens by feature')
    const labels = Array.from(breakdown.querySelectorAll('dt')).map((dt) => dt.textContent)
    expect(labels).toEqual(['Assistant chat', 'Document extraction', 'Report builder', 'Data import'])
    expect(screen.getByText('912K')).toBeInTheDocument()
  })

  it('shows a progress bar against the limit once the plan has one', async () => {
    vi.mocked(subscriptionService.getUsage).mockResolvedValue({
      ...BASE_USAGE,
      storage: { ...BASE_USAGE.storage, usedBytes: 5 * GB, limitBytes: 50 * GB },
      aiTokens: { ...BASE_USAGE.aiTokens, limitTokens: 2_000_000 },
    })
    renderPanel()

    const storageBar = await screen.findByRole('progressbar', { name: 'File storage used' })
    expect(storageBar).toHaveAttribute('aria-valuenow', '10')
    expect(screen.getByText('of 50 GB')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'AI tokens used' })).toHaveAttribute('aria-valuenow', '64')
    expect(screen.queryByText('No limit on your current plan')).not.toBeInTheDocument()
  })

  it('explains a workspace that has not been measured or used AI yet', async () => {
    vi.mocked(subscriptionService.getUsage).mockResolvedValue({
      ...BASE_USAGE,
      storage: { usedBytes: 0, objectCount: 0, measuredAt: null, limitBytes: null },
      aiTokens: { promptTokens: 0, completionTokens: 0, totalTokens: 0, limitTokens: null, bySource: [] },
    })
    renderPanel()

    expect(await screen.findByText('Not measured yet — check back shortly')).toBeInTheDocument()
    expect(screen.getByText('No AI usage this period')).toBeInTheDocument()
    expect(screen.queryByLabelText('AI tokens by feature')).not.toBeInTheDocument()
  })

  it('degrades quietly when the backend has no usage endpoint yet (404)', async () => {
    vi.mocked(subscriptionService.getUsage).mockRejectedValue(httpError(404))
    renderPanel()

    expect(await screen.findByRole('status')).toHaveTextContent("Usage tracking isn't available for your workspace yet.")
    expect(subscriptionService.getUsage).toHaveBeenCalledTimes(1)
  })

  it('surfaces other failures as an alert with the server message', async () => {
    vi.mocked(subscriptionService.getUsage).mockRejectedValue(httpError(403, 'You do not have permission to view subscription usage.'))
    renderPanel()

    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission to view subscription usage.')
  })

  it('shows a loading placeholder while fetching', () => {
    vi.mocked(subscriptionService.getUsage).mockReturnValue(new Promise(() => {}))
    renderPanel()

    expect(screen.getByLabelText('Loading usage')).toHaveAttribute('aria-busy', 'true')
  })
})
