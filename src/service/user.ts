import { httpClient } from '@/api/httpClient'
import { SubsonicResponse } from '@/types/responses/subsonicResponse'

interface UserResponse
  extends SubsonicResponse<{
    user: { username: string; adminRole?: boolean }
  }> {}

async function getUser(username: string) {
  const response = await httpClient<UserResponse>('/getUser', {
    method: 'GET',
    query: { username },
  })

  return response?.data.user
}

export const user = {
  getUser,
}
