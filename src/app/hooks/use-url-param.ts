import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

// A text value kept in the URL, so it survives opening an item and going back
export function useUrlParam(name: string) {
  const [searchParams, setSearchParams] = useSearchParams()
  const value = searchParams.get(name) ?? ''

  const setValue = useCallback(
    (next: string) => {
      setSearchParams(
        (state) => {
          if (next) state.set(name, next)
          else state.delete(name)
          return state
        },
        { replace: true },
      )
    },
    [name, setSearchParams],
  )

  return [value, setValue] as const
}
