import { ImgHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type AppIconProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  size?: number
}

export function AppIcon({ size = 48, className, ...props }: AppIconProps) {
  return (
    <img
      src="/logo.png"
      alt=""
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      {...props}
    />
  )
}
