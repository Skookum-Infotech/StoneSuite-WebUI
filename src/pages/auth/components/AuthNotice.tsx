import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { clearAuthNotice, peekAuthNotice } from '@/lib/authNotice'

// Explains why the user is back on the login page — e.g. their workspace was
// suspended while they were signed in (set by api/client.ts when it ends the
// session). Shown once: read on mount, then cleared so a reload doesn't repeat it.
export function AuthNotice() {
  const [notice] = useState(peekAuthNotice)

  useEffect(() => {
    clearAuthNotice()
  }, [])

  if (!notice) return null
  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-800"
    >
      <AlertTriangle className="mt-px size-4 shrink-0" aria-hidden="true" />
      <span>{notice}</span>
    </div>
  )
}
