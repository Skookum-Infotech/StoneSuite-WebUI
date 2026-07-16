import { useState, useMemo } from 'react'
import { Search, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Invoice, InvoiceStatus } from '@/types/subscription'

const MOCK_INVOICES: Invoice[] = [
  { id: 'INV-2024-0091', date: '2024-06-01', amount: 49.00, status: 'paid'    },
  { id: 'INV-2024-0080', date: '2024-05-01', amount: 49.00, status: 'paid'    },
  { id: 'INV-2024-0069', date: '2024-04-01', amount: 49.00, status: 'paid'    },
  { id: 'INV-2024-0058', date: '2024-03-01', amount: 49.00, status: 'overdue' },
  { id: 'INV-2024-0047', date: '2024-02-01', amount: 19.00, status: 'pending' },
  { id: 'INV-2024-0036', date: '2024-01-01', amount: 19.00, status: 'paid'    },
]

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; dot: string; badge: string }> = {
  paid:    { label: 'Paid',    dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pending: { label: 'Pending', dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 border-amber-200'      },
  overdue: { label: 'Overdue', dot: 'bg-red-500',     badge: 'bg-red-50 text-red-700 border-red-200'            },
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-2xs font-bold', cfg.badge)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

export function BillingHistory() {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return MOCK_INVOICES
    const q = search.toLowerCase()
    return MOCK_INVOICES.filter((inv) => inv.id.toLowerCase().includes(q))
  }, [search])

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      {/* Filter bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center px-4 py-3.5 border-b border-stone-100 bg-stone-50/60">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search by invoice number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-xl border border-stone-200 bg-white pl-8.5 pr-3 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/50 transition"
            aria-label="Search invoices"
          />
        </div>
        <button
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-600 shadow-sm hover:bg-stone-50 transition-colors cursor-pointer"
          aria-label="Download billing history"
        >
          <Download className="size-3.5" />
          Download
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50/40">
              <th className="px-4 py-3 text-left font-semibold text-stone-500">Date</th>
              <th className="px-4 py-3 text-left font-semibold text-stone-500">Invoice #</th>
              <th className="px-4 py-3 text-right font-semibold text-stone-500">Amount</th>
              <th className="px-4 py-3 text-left font-semibold text-stone-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100">
                      <Search className="size-5 text-stone-300" />
                    </div>
                    <p className="text-xs font-semibold text-stone-500">No invoices found</p>
                    <p className="text-xs text-stone-400">Try a different search term</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((inv, idx) => (
                <tr
                  key={inv.id}
                  className={cn(
                    'border-b border-stone-100 transition-colors hover:bg-stone-50/60',
                    idx === filtered.length - 1 && 'border-b-0',
                  )}
                >
                  <td className="px-4 py-3.5 text-stone-600 whitespace-nowrap">{fmtDate(inv.date)}</td>
                  <td className="px-4 py-3.5">
                    <span className="font-mono text-2xs font-semibold text-stone-600">{inv.id}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-bold text-stone-900 tabular-nums">{fmt.format(inv.amount)}</td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={inv.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
