import { useState, useMemo } from 'react'
import {
  CreditCard,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  AlertCircle,
  Search,
  ChevronDown,
  Download,
  RefreshCw,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type TxStatus = 'paid' | 'pending' | 'overdue' | 'refunded' | 'draft'
type TxType   = 'invoice' | 'payment' | 'refund' | 'credit'

interface Transaction {
  id: string
  ref: string
  date: string
  customer: string
  type: TxType
  description: string
  amount: number
  status: TxStatus
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK: Transaction[] = [
  { id: '1',  ref: 'TXN-2024-0041', date: '2024-06-18', customer: 'Elevation Stone',    type: 'invoice', description: 'Marble slab supply — Phase 2',          amount: 24500.00, status: 'paid'     },
  { id: '2',  ref: 'TXN-2024-0040', date: '2024-06-15', customer: 'RidgeLine Builders',  type: 'payment', description: 'Partial payment — project deposit',      amount:  8750.00, status: 'paid'     },
  { id: '3',  ref: 'TXN-2024-0039', date: '2024-06-12', customer: 'Summit Contracting',  type: 'invoice', description: 'Granite countertop installation',         amount: 15200.00, status: 'pending'  },
  { id: '4',  ref: 'TXN-2024-0038', date: '2024-06-08', customer: 'Ashford Renovations', type: 'invoice', description: 'Limestone facade — retail unit 4',        amount: 31000.00, status: 'overdue'  },
  { id: '5',  ref: 'TXN-2024-0037', date: '2024-06-05', customer: 'Crestwood Homes',     type: 'refund',  description: 'Material return — cancelled order',        amount:  3200.00, status: 'refunded' },
  { id: '6',  ref: 'TXN-2024-0036', date: '2024-06-01', customer: 'Pinnacle Interiors',  type: 'invoice', description: 'Quartz worktop supply & fit',              amount: 18750.00, status: 'paid'     },
  { id: '7',  ref: 'TXN-2024-0035', date: '2024-05-28', customer: 'Ironwood Develop.',   type: 'credit',  description: 'Credit note — quantity adjustment',        amount:  1400.00, status: 'paid'     },
  { id: '8',  ref: 'TXN-2024-0034', date: '2024-05-22', customer: 'BluePeak Studios',    type: 'invoice', description: 'Onyx decorative panels — lobby fit-out',   amount: 42000.00, status: 'pending'  },
  { id: '9',  ref: 'TXN-2024-0033', date: '2024-05-18', customer: 'Harlow Estates',      type: 'payment', description: 'Balance payment — residential project',    amount: 11600.00, status: 'overdue'  },
  { id: '10', ref: 'TXN-2024-0032', date: '2024-05-14', customer: 'Meridian Projects',   type: 'invoice', description: 'Travertine tile supply — 800m²',           amount: 27300.00, status: 'draft'    },
  { id: '11', ref: 'TXN-2024-0031', date: '2024-05-10', customer: 'Elevation Stone',     type: 'invoice', description: 'Sandstone paving — garden terrace',        amount:  9850.00, status: 'paid'     },
  { id: '12', ref: 'TXN-2024-0030', date: '2024-05-06', customer: 'Summit Contracting',  type: 'payment', description: 'Final payment — commercial block A',       amount: 38200.00, status: 'paid'     },
]

// ── Config maps ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TxStatus, { label: string; dot: string; badge: string }> = {
  paid:     { label: 'Paid',     dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200'   },
  pending:  { label: 'Pending',  dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 border-amber-200'         },
  overdue:  { label: 'Overdue',  dot: 'bg-red-500',     badge: 'bg-red-50 text-red-700 border-red-200'               },
  refunded: { label: 'Refunded', dot: 'bg-violet-400',  badge: 'bg-violet-50 text-violet-700 border-violet-200'      },
  draft:    { label: 'Draft',    dot: 'bg-stone-400',   badge: 'bg-stone-100 text-stone-600 border-stone-200'        },
}

const TYPE_CONFIG: Record<TxType, { label: string; icon: React.ElementType; color: string }> = {
  invoice: { label: 'Invoice', icon: ArrowUpRight,   color: 'text-stone-500'   },
  payment: { label: 'Payment', icon: ArrowDownRight, color: 'text-emerald-600' },
  refund:  { label: 'Refund',  icon: ArrowUpRight,   color: 'text-violet-600'  },
  credit:  { label: 'Credit',  icon: ArrowDownRight, color: 'text-blue-600'    },
}

const STATUS_FILTER_OPTIONS: { value: TxStatus | 'all'; label: string }[] = [
  { value: 'all',      label: 'All statuses' },
  { value: 'paid',     label: 'Paid'         },
  { value: 'pending',  label: 'Pending'      },
  { value: 'overdue',  label: 'Overdue'      },
  { value: 'refunded', label: 'Refunded'     },
  { value: 'draft',    label: 'Draft'        },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

// ── Summary card ─────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: string; sub: string; icon: React.ElementType; accent: string
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white px-5 py-4 shadow-sm">
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', accent)}>
        <Icon className="size-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-stone-500 truncate">{label}</p>
        <p className="text-base font-bold text-stone-900 leading-tight mt-0.5 truncate">{value}</p>
        <p className="text-2xs text-stone-400 mt-0.5">{sub}</p>
      </div>
    </div>
  )
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TxStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-2xs font-bold', cfg.badge)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 8

export default function TransactionsPage() {
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState<TxStatus | 'all'>('all')
  const [page, setPage]           = useState(1)
  const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('desc')
  const [statusOpen, setStatusOpen] = useState(false)

  const filtered = useMemo(() => {
    let rows = MOCK
    if (statusFilter !== 'all') rows = rows.filter(r => r.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(r =>
        r.ref.toLowerCase().includes(q) ||
        r.customer.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q),
      )
    }
    return [...rows].sort((a, b) =>
      sortDir === 'desc'
        ? b.date.localeCompare(a.date)
        : a.date.localeCompare(b.date),
    )
  }, [search, statusFilter, sortDir])

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const totalPaid    = MOCK.filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0)
  const totalPending = MOCK.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0)
  const totalOverdue = MOCK.filter(r => r.status === 'overdue').reduce((s, r) => s + r.amount, 0)

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-3 sm:p-6 3xl:p-10 4xl:p-14 flex flex-col gap-5">

        {/* ── Page header ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/20 text-brand-dark">
              <CreditCard className="size-4.5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-stone-900">My Transactions</h1>
              <p className="text-xs text-stone-500 mt-0.5">Billing history and payment records</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-600 shadow-sm hover:bg-stone-50 transition-colors cursor-pointer"
              aria-label="Refresh"
            >
              <RefreshCw className="size-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-600 shadow-sm hover:bg-stone-50 transition-colors cursor-pointer"
              aria-label="Export"
            >
              <Download className="size-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Total Transactions"
            value={String(MOCK.length)}
            sub={`${MOCK.length} records`}
            icon={CreditCard}
            accent="bg-stone-100 text-stone-600"
          />
          <StatCard
            label="Total Paid"
            value={fmt.format(totalPaid)}
            sub={`${MOCK.filter(r => r.status === 'paid').length} transactions`}
            icon={ArrowDownRight}
            accent="bg-emerald-50 text-emerald-600"
          />
          <StatCard
            label="Pending"
            value={fmt.format(totalPending)}
            sub={`${MOCK.filter(r => r.status === 'pending').length} awaiting payment`}
            icon={Clock}
            accent="bg-amber-50 text-amber-600"
          />
          <StatCard
            label="Overdue"
            value={fmt.format(totalOverdue)}
            sub={`${MOCK.filter(r => r.status === 'overdue').length} past due date`}
            icon={AlertCircle}
            accent="bg-red-50 text-red-600"
          />
        </div>

        {/* ── Notice ── */}
        <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
          <div className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
          <p className="text-xs text-stone-500">
            Transaction data is currently demo-only. Live billing integration is coming soon.
          </p>
        </div>

        {/* ── Table card ── */}
        <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">

          {/* Filter bar */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center px-4 py-3.5 border-b border-stone-100 bg-stone-50/60">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search by ref, customer, or description…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                className="h-9 w-full rounded-xl border border-stone-200 bg-white pl-8.5 pr-3 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/50 transition"
              />
            </div>

            {/* Status filter */}
            <div className="relative">
              <button
                onClick={() => setStatusOpen(o => !o)}
                className="flex h-9 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer whitespace-nowrap"
              >
                {STATUS_FILTER_OPTIONS.find(o => o.value === statusFilter)?.label}
                <ChevronDown className="size-3.5 text-stone-400" />
              </button>
              {statusOpen && (
                <div className="absolute right-0 top-full z-20 mt-1.5 w-40 rounded-xl border border-stone-200 bg-white shadow-lg py-1.5 animate-in fade-in slide-in-from-top-1 duration-100">
                  {STATUS_FILTER_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setStatus(opt.value); setPage(1); setStatusOpen(false) }}
                      className={cn(
                        'flex w-full items-center gap-2 px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer',
                        statusFilter === opt.value
                          ? 'text-stone-900 bg-stone-100'
                          : 'text-stone-600 hover:bg-stone-50',
                      )}
                    >
                      {opt.value !== 'all' && (
                        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', STATUS_CONFIG[opt.value as TxStatus].dot)} />
                      )}
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Table — horizontal scroll on mobile */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/40">
                  <th className="px-4 py-3 text-left font-semibold text-stone-500 w-36">Reference</th>
                  <th className="px-4 py-3 text-left font-semibold text-stone-500">
                    <button
                      onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                      className="inline-flex items-center gap-1 cursor-pointer hover:text-stone-700 transition-colors"
                    >
                      Date
                      <ArrowUpDown className="size-3 text-stone-400" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-stone-500">Customer</th>
                  <th className="px-4 py-3 text-left font-semibold text-stone-500 hidden md:table-cell">Description</th>
                  <th className="px-4 py-3 text-left font-semibold text-stone-500">Type</th>
                  <th className="px-4 py-3 text-right font-semibold text-stone-500">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold text-stone-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100">
                          <Search className="size-5 text-stone-300" />
                        </div>
                        <p className="text-xs font-semibold text-stone-500">No transactions found</p>
                        <p className="text-xs text-stone-400">Try adjusting your search or filter</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginated.map((tx, idx) => {
                    const typeCfg = TYPE_CONFIG[tx.type]
                    const TypeIcon = typeCfg.icon
                    return (
                      <tr
                        key={tx.id}
                        className={cn(
                          'border-b border-stone-100 transition-colors hover:bg-stone-50/60 cursor-pointer',
                          idx === paginated.length - 1 && 'border-b-0',
                        )}
                      >
                        <td className="px-4 py-3.5">
                          <span className="font-mono text-2xs font-semibold text-stone-600">{tx.ref}</span>
                        </td>
                        <td className="px-4 py-3.5 text-stone-600 whitespace-nowrap">{fmtDate(tx.date)}</td>
                        <td className="px-4 py-3.5">
                          <span className="font-semibold text-stone-800">{tx.customer}</span>
                        </td>
                        <td className="px-4 py-3.5 text-stone-500 hidden md:table-cell max-w-[220px]">
                          <span className="truncate block">{tx.description}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={cn('inline-flex items-center gap-1.5', typeCfg.color)}>
                            <TypeIcon className="size-3.5 shrink-0" />
                            <span className="font-semibold">{typeCfg.label}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={cn('font-bold tabular-nums', tx.type === 'refund' ? 'text-violet-700' : 'text-stone-900')}>
                            {tx.type === 'refund' ? '−' : ''}{fmt.format(tx.amount)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={tx.status} />
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100 bg-stone-50/40">
              <p className="text-xs text-stone-500">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                {Array.from({ length: pageCount }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                      n === page
                        ? 'bg-[#001219] text-white shadow-sm'
                        : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50',
                    )}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(pageCount, p + 1))}
                  disabled={page === pageCount}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  aria-label="Next page"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
