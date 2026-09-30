import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { InsightsIcon } from '@/app/components/icons/phosphor-icons'
import { InsightsDialog } from '@/app/components/insights/dialog'
import { Button } from '@/app/components/ui/button'
import { SimpleTooltip } from '@/app/components/ui/simple-tooltip'

export function InsightsButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <SimpleTooltip text={t('header.insights')} side="bottom">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 rounded-full"
          onClick={() => setOpen(true)}
          data-testid="insights-button"
        >
          <InsightsIcon className="w-4 h-4" />
        </Button>
      </SimpleTooltip>

      <InsightsDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
