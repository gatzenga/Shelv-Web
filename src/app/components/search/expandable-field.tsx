import clsx from 'clsx'
import { SearchIcon, XIcon } from 'lucide-react'
import { ComponentPropsWithoutRef, FormEvent, RefObject } from 'react'
import { Input } from '@/app/components/ui/input'

type ExpandableFieldProps = Omit<
  ComponentPropsWithoutRef<typeof Input>,
  'onSubmit'
> & {
  active: boolean
  inputRef: RefObject<HTMLInputElement>
  onToggle: () => void
  onSubmit?: (event: FormEvent) => void
}

// Search icon that expands into a text field, used in page headers
export function ExpandableField({
  active,
  inputRef,
  onToggle,
  onSubmit,
  placeholder,
  ...props
}: ExpandableFieldProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit?.(event)
      }}
    >
      <div className="relative inline-block w-fit min-w-9 h-9 align-bottom rounded-md overflow-hidden">
        <Input
          id="search"
          ref={inputRef}
          placeholder={placeholder}
          className={clsx(
            'bg-background h-full z-10 left-auto duration-300',
            'focus-visible:ring-transparent ring-offset-background',
            'focus-visible:ring-offset-0 focus-visible:ring-0',
            active
              ? 'w-[260px] pr-9 text-foreground placeholder:opacity-100'
              : 'w-9 text-transparent placeholder:opacity-0',
          )}
          {...props}
        />
        <label
          htmlFor="search"
          className={clsx(
            'absolute w-9 h-9 m-0 right-0 top-0',
            'inline-flex items-center justify-center',
            'leading-10 cursor-pointer text-center z-30',
            'hover:bg-accent rounded-md',
          )}
          aria-label={placeholder}
          onClick={onToggle}
        >
          <SearchIcon
            data-visible={active ? 'hide' : 'show'}
            className="w-4 h-4 text-muted-foreground pointer-events-none rotate-0 scale-100 transition-transform data-[visible=hide]:-rotate-90 data-[visible=hide]:scale-0"
          />
          <XIcon
            data-visible={active ? 'show' : 'hide'}
            className="absolute w-5 h-5 text-muted-foreground pointer-events-none rotate-90 scale-0 transition-transform data-[visible=show]:rotate-0 data-[visible=show]:scale-100"
          />
        </label>
      </div>
    </form>
  )
}
