import { useQuery } from '@tanstack/react-query'
import { getFavorites } from '@/queries/songs'
import { queryKeys } from '@/utils/queryKeys'

export function useFavorites() {
  return useQuery({
    queryKey: [queryKeys.favorites.all],
    queryFn: getFavorites,
  })
}
