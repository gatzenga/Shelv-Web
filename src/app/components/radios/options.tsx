import { Pencil, Trash } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { MenuItemFactory } from '@/app/components/options/menu-item-factory'
import { useRadios } from '@/store/radios.store'
import { Radio } from '@/types/responses/radios'

interface RadioOptionsProps {
  radio: Radio
  variant?: 'dropdown' | 'context'
}

export function RadioOptions({
  radio,
  variant = 'dropdown',
}: RadioOptionsProps) {
  const { t } = useTranslation()
  const { setDialogState, setData, setConfirmDeleteState } = useRadios()

  return (
    <>
      <MenuItemFactory
        variant={variant}
        icon={<Pencil className="mr-2 h-4 w-4" />}
        label={t('radios.table.actions.edit')}
        onClick={() => {
          setData(radio)
          setDialogState(true)
        }}
      />
      <MenuItemFactory
        variant={variant}
        icon={<Trash className="mr-2 h-4 w-4 fill-red-300 text-red-500" />}
        label={t('radios.table.actions.delete')}
        className="text-red-500"
        onClick={() => {
          setData(radio)
          setConfirmDeleteState(true)
        }}
      />
    </>
  )
}
