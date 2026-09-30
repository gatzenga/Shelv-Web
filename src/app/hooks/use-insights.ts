import { useQuery } from '@tanstack/react-query'
import { getInsights } from '@/service/insights'
import { convertMinutesToMs } from '@/utils/convertSecondsToTime'

export const useGetInsights = (enabled: boolean) => {
  return useQuery({
    queryKey: ['get-insights'],
    queryFn: getInsights,
    enabled,
    staleTime: convertMinutesToMs(30),
  })
}
