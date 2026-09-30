import { ComponentType } from 'react'
import { Explore } from '@/app/components/home/explore'
import { MostPlayed } from '@/app/components/home/most-played'
import { RecentlyAdded } from '@/app/components/home/recently-added'
import { RecentlyPlayed } from '@/app/components/home/recently-played'
import { SmartMixes } from '@/app/components/home/smart-mixes'
import { appConfig, DiscoverSection } from '@/utils/appConfig'

const sections: Record<DiscoverSection, ComponentType> = {
  'smart-mixes': SmartMixes,
  'recently-added': RecentlyAdded,
  'recently-played': RecentlyPlayed,
  'frequently-played': MostPlayed,
  'random-albums': Explore,
}

export default function Home() {
  return (
    <div className="w-full px-8 py-6">
      {appConfig.discoverSections.map((name) => {
        const Section = sections[name]

        return <Section key={name} />
      })}
    </div>
  )
}
