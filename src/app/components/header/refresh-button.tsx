import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { RefreshIcon } from '@/app/components/icons/phosphor-icons'
import { Button } from '@/app/components/ui/button'
import { SimpleTooltip } from '@/app/components/ui/simple-tooltip'
import { cn } from '@/lib/utils'

export function RefreshButton() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isFetching = useIsFetching() > 0

  return (
    <SimpleTooltip text={t('header.refresh')} side="bottom">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 rounded-full"
        disabled={isFetching}
        onClick={() => queryClient.invalidateQueries()}
        data-testid="refresh-button"
      >
        <RefreshIcon className={cn('w-4 h-4', isFetching && 'animate-spin')} />
      </Button>
    </SimpleTooltip>
  )
}
