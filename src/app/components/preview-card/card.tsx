import { Pause, Play } from 'lucide-react'
import React, { ComponentPropsWithoutRef } from 'react'
import { LazyLoadImage } from 'react-lazy-load-image-component'
import { Link } from 'react-router-dom'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/lib/utils'

interface Children {
  children: React.ReactNode
}

type RootProps = ComponentPropsWithoutRef<'div'>

const Root = React.forwardRef<HTMLDivElement, RootProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('cursor-pointer', className)} {...props}>
      {children}
    </div>
  ),
)
Root.displayName = 'PreviewCardRoot'

interface ImageWrapperProps extends Children {
  link: string
  className?: string
}

function ImageWrapper({ children, link, className }: ImageWrapperProps) {
  return (
    <div
      className={cn(
        'group flex-1 aspect-square rounded bg-border relative overflow-hidden',
        // a slight zoom like in the Shelv app, the texts below stay on top
        'shadow-md transition-[transform,box-shadow] duration-150 ease-in-out',
        'hover:scale-[1.03] hover:shadow-xl motion-reduce:transition-none motion-reduce:hover:scale-100',
        className,
      )}
    >
      <Link
        to={link}
        data-testid="card-image-link"
        className="flex h-full w-full"
      >
        {children}
      </Link>
    </div>
  )
}

interface ImageProps {
  src?: string
  alt: string
}

function Image({ src, alt }: ImageProps) {
  return (
    <LazyLoadImage
      src={src}
      alt={alt}
      effect="opacity"
      width="100%"
      height="100%"
      className="aspect-square object-cover w-full h-full absolute inset-0 z-0"
      data-testid="card-image"
    />
  )
}

type CardButtonProps = ComponentPropsWithoutRef<'button'> & {
  onClick: () => void
  dataTestId: string
}

function CardButton({ onClick, dataTestId, children }: CardButtonProps) {
  return (
    <div className="w-full h-full flex items-center justify-center rounded bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-300 absolute inset-0 z-10">
      <Button
        className="opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-full w-12 h-12 z-20"
        variant="outline"
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          onClick()
        }}
        data-testid={dataTestId}
      >
        {children}
      </Button>
    </div>
  )
}

interface PlayPauseButtonProps {
  onClick: () => void
}

function PlayButton({ onClick }: PlayPauseButtonProps) {
  return (
    <CardButton dataTestId="card-play-button" onClick={onClick}>
      <Play className="fill-foreground" />
    </CardButton>
  )
}

function PauseButton({ onClick }: PlayPauseButtonProps) {
  return (
    <CardButton dataTestId="card-pause-button" onClick={onClick}>
      <Pause className="fill-foreground" />
    </CardButton>
  )
}

interface InfoWrapperProps extends Children {}

function InfoWrapper({ children }: InfoWrapperProps) {
  return (
    <div className="relative z-10 flex flex-col flex-1 min-w-0 cursor-default">
      {children}
    </div>
  )
}

interface TitleProps {
  link: string
  className?: string
  children: string
}

function Title({ link, children, className }: TitleProps) {
  return (
    <div className="w-full truncate mt-0.5" data-testid="card-title">
      <Link
        to={link}
        className={cn(
          'max-w-full truncate hover:underline leading-7 text-sm font-semibold',
          className,
        )}
        data-testid="card-title-link"
      >
        {children}
      </Link>
    </div>
  )
}

interface SubtitleProps {
  link?: string
  children: React.ReactNode
  enableLink?: boolean
  className?: string
}

function Subtitle({
  link,
  children,
  enableLink = true,
  className,
}: SubtitleProps) {
  if (!enableLink || !link) {
    return (
      <div className="w-full">
        <p
          className={cn(
            'leading-5 truncate text-xs text-muted-foreground -mt-0.5',
            className,
          )}
          data-testid="card-subtitle"
        >
          {children}
        </p>
      </div>
    )
  }

  return (
    <div className="flex w-full truncate -mt-0.5" data-testid="card-subtitle">
      <Link
        to={link}
        data-testid="card-subtitle-link"
        className={cn(
          'max-w-full truncate text-xs text-muted-foreground hover:underline',
          className,
        )}
      >
        {children}
      </Link>
    </div>
  )
}

export const PreviewCard = {
  Root,
  ImageWrapper,
  Image,
  PlayButton,
  InfoWrapper,
  Title,
  Subtitle,
  PauseButton,
}
