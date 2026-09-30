import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { InsightsIcon } from '@/app/components/icons/phosphor-icons'
import { Button } from '@/app/components/ui/button'
import { SimpleTooltip } from '@/app/components/ui/simple-tooltip'
import { ROUTES } from '@/routes/routesList'

export function InsightsButton() {
  const { t } = useTranslation()

  return (
    <SimpleTooltip text={t('header.insights')} side="bottom">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 rounded-full"
        data-testid="insights-button"
      >
        <Link to={ROUTES.INSIGHTS}>
          <InsightsIcon className="w-4 h-4" />
        </Link>
      </Button>
    </SimpleTooltip>
  )
}
