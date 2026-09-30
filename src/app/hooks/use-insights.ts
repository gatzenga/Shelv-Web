import { useQuery } from '@tanstack/react-query'
import { getInsights } from '@/service/insights'
import { convertMinutesToMs } from '@/utils/convertSecondsToTime'

export const useGetInsights = () => {
  return useQuery({
    queryKey: ['get-insights'],
    queryFn: getInsights,
    staleTime: convertMinutesToMs(30),
  })
}
