import { useCallback, useState } from 'react'

// State that survives a reload, for the view settings of a page
export function usePersistedState<T extends string | boolean>(
  key: string,
  initialValue: T,
  isValid: (value: unknown) => value is T = (value): value is T =>
    typeof value === typeof initialValue,
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored === null) return initialValue

      const parsed = JSON.parse(stored)
      return isValid(parsed) ? parsed : initialValue
    } catch {
      return initialValue
    }
  })

  const update = useCallback(
    (next: T) => {
      setValue(next)
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // storage is not available, the setting only lasts for this visit
      }
    },
    [key],
  )

  return [value, update] as const
}
