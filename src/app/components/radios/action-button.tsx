import { RadioOptions } from '@/app/components/radios/options'
import { TableActionButton } from '@/app/components/table/action-button'
import { Radio } from '@/types/responses/radios'

interface RadioActionButtonProps {
  row: Radio
}

export function RadioActionButton({ row }: RadioActionButtonProps) {
  return <TableActionButton optionsMenuItems={<RadioOptions radio={row} />} />
}
