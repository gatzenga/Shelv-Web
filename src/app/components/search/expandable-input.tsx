import {
  ComponentPropsWithoutRef,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useSearchParams } from 'react-router-dom'
import { Input } from '@/app/components/ui/input'
import { AlbumsFilters, AlbumsSearchParams } from '@/utils/albumsFilter'
import { SearchParamsHandler } from '@/utils/searchParamsHandler'
import { ExpandableField } from './expandable-field'

type SearchInputProps = Omit<ComponentPropsWithoutRef<typeof Input>, 'onSubmit'>

export function ExpandableSearchInput({ ...props }: SearchInputProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { getSearchParam } = new SearchParamsHandler(searchParams)

  const filter = getSearchParam<string>(AlbumsSearchParams.MainFilter, '')
  const query = getSearchParam<string>(AlbumsSearchParams.Query, '')

  const [searchActive, setSearchActive] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const setParams = useCallback(
    (value: string) => {
      const params = new URLSearchParams()

      if (value) {
        params.append(AlbumsSearchParams.MainFilter, AlbumsFilters.Search)
        params.append(AlbumsSearchParams.Query, value)

        setSearchParams(params)
      } else {
        inputRef.current?.blur()
      }
    },
    [setSearchParams],
  )

  const close = useCallback(() => {
    setSearchActive(false)
    setSearchValue('')
    if (filter !== '' || query !== '') {
      setSearchParams(new URLSearchParams())
    }
    if (inputRef.current) {
      inputRef.current.blur()
      inputRef.current.value = ''
    }
  }, [filter, query, setSearchParams])

  const toggleSearchActive = useCallback(() => {
    if (!searchActive) {
      setSearchActive(true)
    } else {
      close()
    }
  }, [close, searchActive])

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault()
      setParams(searchValue)
    },
    [searchValue, setParams],
  )

  useEffect(() => {
    setSearchActive(filter === AlbumsFilters.Search)
  }, [filter])

  useEffect(() => {
    setSearchValue(query)
  }, [query])

  useEffect(() => {
    if (!inputRef.current) return

    if (filter === AlbumsFilters.Search && query !== '') {
      inputRef.current.focus()
    }

    inputRef.current.value = query
  }, [filter, query])

  return (
    <ExpandableField
      active={searchActive}
      inputRef={inputRef}
      onToggle={toggleSearchActive}
      onSubmit={handleSubmit}
      onChange={(e) => setSearchValue(e.target.value)}
      {...props}
    />
  )
}
