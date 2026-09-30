import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronsUpDown,
  LayoutGridIcon,
  ListFilter,
  ListIcon,
  Loader2Icon,
  PlayIcon,
  ShuffleIcon,
} from 'lucide-react'
import { ComponentPropsWithoutRef, ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/app/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/app/components/ui/command'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { Input } from '@/app/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import { SimpleTooltip } from '@/app/components/ui/simple-tooltip'
import { cn } from '@/lib/utils'
import { PageViewType } from '@/types/serverConfig'
import { GenreOption, SortDirection } from './sorting'

// The row under the page header with filter, sort and view controls, like the
// toolbar of the Library screens in the Shelv app
export function LibraryToolbar({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-8 py-2.5 border-b bg-background',
        className,
      )}
      {...props}
    />
  )
}

interface LibraryFilterInputProps {
  value: string
  onChange: (value: string) => void
}

export function LibraryFilterInput({
  value,
  onChange,
}: LibraryFilterInputProps) {
  const { t } = useTranslation()

  return (
    <Input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={t('library.filter')}
      className="h-9 w-[220px] max-w-[220px]"
      data-testid="library-filter"
    />
  )
}

interface LibrarySortMenuProps<T extends string> {
  options: T[]
  value: T
  labelKey: (option: T) => string
  onChange: (option: T) => void
}

export function LibrarySortMenu<T extends string>({
  options,
  value,
  labelKey,
  onChange,
}: LibrarySortMenuProps<T>) {
  const { t } = useTranslation()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" data-testid="library-sort">
          <ListFilter className="w-4 h-4 mr-2" />
          {t(labelKey(value))}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option}
            checked={option === value}
            onCheckedChange={() => onChange(option)}
            className="cursor-pointer"
          >
            {t(labelKey(option))}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface LibraryDirectionButtonProps {
  direction: SortDirection
  onToggle: () => void
}

export function LibraryDirectionButton({
  direction,
  onToggle,
}: LibraryDirectionButtonProps) {
  const { t } = useTranslation()
  const isAscending = direction === 'asc'

  return (
    <SimpleTooltip text={t(isAscending ? 'table.sort.asc' : 'table.sort.desc')}>
      <Button variant="outline" size="sm" onClick={onToggle}>
        {isAscending ? (
          <ArrowUp className="w-4 h-4" />
        ) : (
          <ArrowDown className="w-4 h-4" />
        )}
      </Button>
    </SimpleTooltip>
  )
}

interface LibraryViewToggleProps {
  viewType: PageViewType
  onChange: (viewType: PageViewType) => void
}

// One button that switches to the other view, like in the Shelv app
export function LibraryViewToggle({
  viewType,
  onChange,
}: LibraryViewToggleProps) {
  const { t } = useTranslation()
  const isGrid = viewType === 'grid'

  return (
    <SimpleTooltip
      text={t(
        isGrid
          ? 'generic.viewMode.modes.list'
          : 'generic.viewMode.modes.poster',
      )}
    >
      <Button
        variant="outline"
        size="icon"
        className="size-9"
        onClick={() => onChange(isGrid ? 'table' : 'grid')}
        data-testid="library-view-toggle"
      >
        {isGrid ? (
          <ListIcon className="size-4" />
        ) : (
          <LayoutGridIcon className="size-4" />
        )}
      </Button>
    </SimpleTooltip>
  )
}

interface LibraryPlaybackButtonsProps {
  // only the shuffle button, for lists that have no order of their own
  shuffleOnly?: boolean
  disabled: boolean
  loading: 'play' | 'shuffle' | null
  onPlay: () => void
  onShuffle: () => void
}

export function LibraryPlaybackButtons({
  shuffleOnly = false,
  disabled,
  loading,
  onPlay,
  onShuffle,
}: LibraryPlaybackButtonsProps) {
  const { t } = useTranslation()

  function renderButton(
    kind: 'play' | 'shuffle',
    label: string,
    icon: ReactNode,
    onClick: () => void,
  ) {
    return (
      <SimpleTooltip text={label}>
        <Button
          variant="outline"
          size="icon"
          className="size-9"
          disabled={disabled || loading !== null}
          onClick={onClick}
          aria-label={label}
          data-testid={`library-${kind}`}
        >
          {loading === kind ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            icon
          )}
        </Button>
      </SimpleTooltip>
    )
  }

  return (
    <>
      {!shuffleOnly &&
        renderButton(
          'play',
          t('options.play'),
          <PlayIcon className="size-4 fill-current" />,
          onPlay,
        )}
      {renderButton(
        'shuffle',
        t('album.actions.shuffle'),
        <ShuffleIcon className="size-4" />,
        onShuffle,
      )}
    </>
  )
}

interface LibraryGenreSelectProps {
  genres: GenreOption[]
  value: string
  onChange: (genre: string) => void
}

// "" is all genres
export function LibraryGenreSelect({
  genres,
  value,
  onChange,
}: LibraryGenreSelectProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const selected = genres.find((genre) => genre.name === value)

  function select(genre: string) {
    onChange(genre)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
          data-testid="library-genre"
        >
          <span className="truncate">
            {selected ? selected.name : t('library.allGenres')}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="end">
        <Command>
          <CommandInput placeholder={t('album.list.genre.search')} />
          <ScrollArea className="h-[300px]" type="always">
            <CommandList className="max-h-fit">
              <CommandEmpty>
                <div className="px-2">{t('album.list.genre.notFound')}</div>
              </CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value={t('library.allGenres')}
                  onSelect={() => select('')}
                  className="mr-1.5"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selected ? 'opacity-0' : 'opacity-100',
                    )}
                  />
                  {t('library.allGenres')}
                </CommandItem>
                {genres.map((genre) => (
                  <CommandItem
                    key={genre.name}
                    value={genre.name}
                    onSelect={() => select(genre.name)}
                    className="mr-1.5"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selected?.name === genre.name
                          ? 'opacity-100'
                          : 'opacity-0',
                      )}
                    />
                    <span className="truncate">{genre.name}</span>
                    <span className="ml-auto pl-2 text-xs text-muted-foreground">
                      {genre.albumCount}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </ScrollArea>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
