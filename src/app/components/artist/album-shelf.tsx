import { ChevronRightIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlbumGridCard } from '@/app/components/albums/album-grid-card'
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from '@/app/components/ui/carousel'
import { CarouselButton } from '@/app/components/ui/carousel-button'
import { Albums } from '@/types/responses/album'

interface ArtistAlbumShelfProps {
  title: string
  titleRoute: string
  albums: Albums[]
  // What sits left of the scroll buttons, the sort controls
  controls?: React.ReactNode
}

// One row of albums. The title opens the full list, below it the sort controls
// with the scroll buttons, then the albums, like the shelves in the Shelv app.
export function ArtistAlbumShelf({
  title,
  titleRoute,
  albums,
  controls,
}: ArtistAlbumShelfProps) {
  const [api, setApi] = useState<CarouselApi>()
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  useEffect(() => {
    if (!api) return

    function update() {
      setCanScrollPrev(api?.canScrollPrev() ?? false)
      setCanScrollNext(api?.canScrollNext() ?? false)
    }

    update()
    api.on('select', update)
    api.on('reInit', update)

    return () => {
      api.off('select', update)
      api.off('reInit', update)
    }
  }, [api])

  return (
    <div className="w-full flex flex-col gap-4" data-testid="artist-albums">
      <Link
        to={titleRoute}
        className="flex items-center gap-1 w-fit hover:text-primary transition-colors"
      >
        <h3
          className="scroll-m-20 text-2xl font-semibold tracking-tight"
          data-testid="preview-list-title"
        >
          {title}
        </h3>
        <ChevronRightIcon className="size-6 text-muted-foreground" />
      </Link>

      <div className="flex items-center justify-between gap-4">
        <div>{controls}</div>
        <div className="flex gap-2">
          <CarouselButton
            direction="prev"
            disabled={!canScrollPrev}
            onClick={() => api?.scrollPrev()}
            data-testid="preview-list-prev-button"
          />
          <CarouselButton
            direction="next"
            disabled={!canScrollNext}
            onClick={() => api?.scrollNext()}
            data-testid="preview-list-next-button"
          />
        </div>
      </div>

      <div className="transform-gpu @container">
        <Carousel
          opts={{ align: 'start', slidesToScroll: 'auto' }}
          setApi={setApi}
          data-testid="preview-list-carousel"
        >
          <CarouselContent>
            {albums.map((album, index) => (
              <CarouselItem
                key={album.id}
                className="shrink-0 basis-[176px] max-w-[176px]"
                data-testid={`preview-list-carousel-item-${index}`}
              >
                <AlbumGridCard album={album} subtitleType="year" />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>
    </div>
  )
}
