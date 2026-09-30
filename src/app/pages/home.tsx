import { Explore } from '@/app/components/home/explore'
import { MostPlayed } from '@/app/components/home/most-played'
import { RecentlyAdded } from '@/app/components/home/recently-added'
import { RecentlyPlayed } from '@/app/components/home/recently-played'
import { SmartMixes } from '@/app/components/home/smart-mixes'

export default function Home() {
  return (
    <div className="w-full px-8 py-6">
      <SmartMixes />
      <RecentlyAdded />
      <RecentlyPlayed />
      <MostPlayed />
      <Explore />
    </div>
  )
}
