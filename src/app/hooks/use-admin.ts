import { useQuery } from '@tanstack/react-query'
import { subsonic } from '@/service/subsonic'
import { useAppData } from '@/store/app.store'

// Whether the signed in user is an administrator of the server
export function useIsAdmin() {
  const { username } = useAppData()

  const { data } = useQuery({
    queryKey: ['get-user', username],
    queryFn: () => subsonic.user.getUser(username),
    enabled: Boolean(username),
    staleTime: Number.POSITIVE_INFINITY,
  })

  return data?.adminRole === true
}
