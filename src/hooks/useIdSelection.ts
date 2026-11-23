import { useCallback, useMemo, useState } from 'react'

// A checked-rows set for a list. Only ids still present in `validIds` count, so
// a row that disappears (deactivated, filtered out) drops out of the selection
// without any cleanup effect.
export function useIdSelection(validIds: string[]) {
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set())

  const selected = useMemo(() => new Set(validIds.filter((id) => picked.has(id))), [validIds, picked])

  const toggle = useCallback((id: string) => {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const setAll = useCallback((ids: string[]) => setPicked(new Set(ids)), [])
  const clear = useCallback(() => setPicked(new Set()), [])

  return { selected, toggle, setAll, clear }
}
