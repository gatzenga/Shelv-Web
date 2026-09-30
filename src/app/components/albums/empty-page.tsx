import { useTranslation } from 'react-i18next'
import { ShadowHeader } from '@/app/components/album/shadow-header'
import { EmptyPageContainer } from '@/app/components/empty-container'
import { HeaderTitle } from '@/app/components/header-title'
import ListWrapper from '@/app/components/list-wrapper'
import { EmptyAlbumsInfo } from './empty-message'
import { EmptyWrapper } from './empty-wrapper'

export function EmptyAlbums() {
  const { t } = useTranslation()

  return (
    <EmptyPageContainer>
      <ShadowHeader>
        <HeaderTitle title={t('sidebar.albums')} />
      </ShadowHeader>

      <ListWrapper className="h-full">
        <EmptyWrapper>
          <EmptyAlbumsInfo />
        </EmptyWrapper>
      </ListWrapper>
    </EmptyPageContainer>
  )
}
