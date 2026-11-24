import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Loader2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { automationDigestService } from '@/services/automationDigestService'
import { apiErrorMessage } from '@/api/tenantClient'
import { DIGEST_HOURS, digestHourLabel, hasDigestSection, sameDigestPrefs } from '@/lib/digestPrefs'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { DigestPrefs } from '@/types/automationDigest'

const DIGEST_KEY = ['automation-digest-prefs'] as const
const SAVE_FALLBACK = "We couldn't save your daily digest setting."

type SectionKey = 'includeInstalls' | 'includeVendorBills' | 'includeApprovals'

const SECTIONS: { key: SectionKey; label: string; hint: string }[] = [
  { key: 'includeInstalls', label: 'Upcoming installations', hint: 'Installations in the next 3 days that you are assigned to.' },
  { key: 'includeVendorBills', label: 'Vendor bills due', hint: 'Bills you are responsible for that are due within 3 days or overdue.' },
  { key: 'includeApprovals', label: 'Pending approvals', hint: 'Quotes, estimates and sales orders waiting for your approval.' },
]

// Account Settings > Notifications. The daily digest is one email plus one in-app notification a day
// summarising what needs the person's attention. It is off until they turn it on.
export function DailyDigestCard() {
  const queryClient = useQueryClient()
  const saved = useQuery({ queryKey: DIGEST_KEY, queryFn: () => automationDigestService.get() })
  const [draft, setDraft] = useState<DigestPrefs | null>(null)

  const save = useMutation({
    mutationFn: (p: DigestPrefs) => automationDigestService.save(p),
    onSuccess: (p) => {
      queryClient.setQueryData(DIGEST_KEY, p)
      setDraft(null)
      toast.success(p.enabled ? 'Daily digest saved.' : 'Daily digest is off.')
    },
  })

  const current = draft ?? saved.data
  const change = (patch: Partial<DigestPrefs>) => {
    if (current) setDraft({ ...current, ...patch })
  }
  const dirty = Boolean(draft) && Boolean(saved.data) && !sameDigestPrefs(draft, saved.data)
  const needsSection = Boolean(current) && current.enabled && !hasDigestSection(current)

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-100 bg-stone-50/60 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/20 text-brand-dark">
            <Mail className="size-4.5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-stone-900">Daily digest</h2>
            <p className="mt-0.5 text-xs text-stone-500">One email and one notification a day with what needs your attention</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-6 sm:py-6">
        {saved.isPending ? (
          <div className="flex items-center gap-2 py-4 text-xs text-stone-500">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading…
          </div>
        ) : saved.isError || !current ? (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3.5">
            <p className="flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              We couldn&apos;t load your daily digest setting.
            </p>
            <Button type="button" variant="outline" onClick={() => saved.refetch()} className="h-8 rounded-lg px-3 text-xs">
              Try again
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p id="digest-label" className="text-xs font-bold text-stone-900">Send me a daily digest</p>
                <p id="digest-hint" className="mt-1 text-xs text-stone-500">Sent to your account email and shown in your notifications.</p>
              </div>
              <Switch checked={current.enabled} onCheckedChange={(enabled) => change({ enabled })} aria-labelledby="digest-label" aria-describedby="digest-hint" />
            </div>

            <div className={current.enabled ? 'space-y-5' : 'space-y-5 opacity-50'}>
              <div>
                <label htmlFor="digest-hour" className="text-xs font-bold text-stone-900">Send it at</label>
                <select
                  id="digest-hour"
                  value={current.sendHour}
                  disabled={!current.enabled}
                  onChange={(e) => change({ sendHour: Number(e.target.value) })}
                  className="mt-1.5 block h-9 w-40 rounded-lg border border-stone-200 bg-white px-2 text-xs text-stone-800"
                >
                  {DIGEST_HOURS.map((h) => (
                    <option key={h} value={h}>{digestHourLabel(h)}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-stone-500">Your workspace&apos;s local time. It goes out on the first check after this hour.</p>
              </div>

              <fieldset className="space-y-3">
                <legend className="text-xs font-bold text-stone-900">Include</legend>
                {SECTIONS.map((s) => (
                  <label key={s.key} className="flex items-start gap-2.5 text-xs text-stone-700">
                    <input
                      type="checkbox"
                      checked={current[s.key]}
                      disabled={!current.enabled}
                      onChange={(e) => change({ [s.key]: e.target.checked })}
                      className="mt-0.5 size-4 rounded border-stone-300"
                    />
                    <span>
                      <span className="font-semibold text-stone-900">{s.label}</span>
                      <span className="block text-stone-500">{s.hint}</span>
                    </span>
                  </label>
                ))}
                <label className="flex items-start gap-2.5 text-xs text-stone-700">
                  <input
                    type="checkbox"
                    checked={current.skipEmpty}
                    disabled={!current.enabled}
                    onChange={(e) => change({ skipEmpty: e.target.checked })}
                    className="mt-0.5 size-4 rounded border-stone-300"
                  />
                  <span className="font-semibold text-stone-900">Skip days with nothing to report</span>
                </label>
              </fieldset>
            </div>

            {needsSection && (
              <p role="alert" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                Choose at least one thing to include.
              </p>
            )}
            {save.isError && (
              <p role="alert" className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-destructive">
                <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                {apiErrorMessage(save.error, SAVE_FALLBACK)}
              </p>
            )}

            <div className="flex justify-end">
              <Button type="button" disabled={!dirty || needsSection || save.isPending} onClick={() => draft && save.mutate(draft)}>
                {save.isPending ? <><Loader2 className="mr-2 size-4 animate-spin" />Saving…</> : 'Save'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
