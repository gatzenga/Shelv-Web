import { ShuffleIcon, SparklesIcon } from 'lucide-react'
import { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

// Filled like the SF Symbols "sparkles", "chart.bar.fill", "clock.fill"
// and "shuffle" of the Shelv app
export function MixSparklesIcon(props: IconProps) {
  return <SparklesIcon fill="currentColor" {...props} />
}

export function MixChartIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <rect x="3" y="13" width="5" height="8" rx="1.3" />
      <rect x="9.5" y="3" width="5" height="18" rx="1.3" />
      <rect x="16" y="8" width="5" height="13" rx="1.3" />
    </svg>
  )
}

export function MixClockIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <defs>
        <mask id="mix-clock-hands">
          <rect width="24" height="24" fill="white" />
          <path
            d="M12 6.5V12l3.5 2"
            fill="none"
            stroke="black"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </mask>
      </defs>
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="currentColor"
        mask="url(#mix-clock-hands)"
      />
    </svg>
  )
}

export function MixShuffleIcon(props: IconProps) {
  return <ShuffleIcon {...props} />
}
