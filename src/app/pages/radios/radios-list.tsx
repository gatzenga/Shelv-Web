import { useQuery } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ShadowHeader } from '@/app/components/album/shadow-header'
import { EmptyWrapper } from '@/app/components/albums/empty-wrapper'
import { SongListFallback } from '@/app/components/fallbacks/song-fallbacks'
import { HeaderTitle } from '@/app/components/header-title'
import { LibraryPage } from '@/app/components/library/page'
import {
  LibraryFilterInput,
  LibraryToolbar,
} from '@/app/components/library/toolbar'
import ListWrapper from '@/app/components/list-wrapper'
import { EmptyRadiosInfo } from '@/app/components/radios/empty-message'
import { RadioFormDialog } from '@/app/components/radios/form-dialog'
import { RemoveRadioDialog } from '@/app/components/radios/remove-dialog'
import { Button } from '@/app/components/ui/button'
import { DataTable } from '@/app/components/ui/data-table'
import { useUrlParam } from '@/app/hooks/use-url-param'
import { radiosColumns } from '@/app/tables/radios-columns'
import { subsonic } from '@/service/subsonic'
import { usePlayerActions } from '@/store/player.store'
import { useRadios } from '@/store/radios.store'
import { Radio } from '@/types/responses/radios'
import { queryKeys } from '@/utils/queryKeys'

export default function Radios() {
  const { setDialogState, setData } = useRadios()
  const { t } = useTranslation()
  const { setPlayRadio } = usePlayerActions()

  const { data: radios, isLoading } = useQuery({
    queryKey: [queryKeys.radio.all],
    queryFn: subsonic.radios.getAll,
  })

  const columns = radiosColumns()
  const [query, setQuery] = useUrlParam('query')

  const filteredRadios = useMemo(() => {
    const search = query.trim().toLowerCase()

    return (radios ?? []).filter(
      (radio) => !search || radio.name.toLowerCase().includes(search),
    )
  }, [radios, query])

  function handleAddRadio() {
    setData({} as Radio)
    setDialogState(true)
  }

  if (isLoading) return <SongListFallback />

  const showTable = radios && radios.length > 0

  return (
    <LibraryPage
      header={
        <>
          <ShadowHeader fixed={false} showGlassEffect={false}>
            <HeaderTitle
              title={t('sidebar.radios')}
              count={filteredRadios.length}
            />
          </ShadowHeader>

          <LibraryToolbar>
            <LibraryFilterInput value={query} onChange={setQuery} />

            <Button
              size="sm"
              variant="default"
              className="ml-auto px-4"
              onClick={handleAddRadio}
            >
              <PlusIcon className="w-5 h-5 -ml-[3px]" />
              <span className="ml-2">{t('radios.addRadio')}</span>
            </Button>
          </LibraryToolbar>
        </>
      }
    >
      {showTable && (
        <ListWrapper>
          <DataTable
            columns={columns}
            data={filteredRadios}
            handlePlaySong={(row) => setPlayRadio(filteredRadios, row.index)}
            showPagination={true}
            showSearch={false}
            allowRowSelection={false}
            dataType="radio"
          />
        </ListWrapper>
      )}

      {!showTable && (
        <ListWrapper>
          <EmptyWrapper>
            <EmptyRadiosInfo />
          </EmptyWrapper>
        </ListWrapper>
      )}

      <RadioFormDialog />
      <RemoveRadioDialog />
    </LibraryPage>
  )
}
