import { getBackendUrl } from '@/api/httpClient'
import { genPasswordToken, saltWord } from '@/utils/salt'

// The server checks the login with Navidrome and answers with a cookie. After
// that no credentials are sent any more, the cookie is enough.
export async function login(
  url: string,
  username: string,
  password: string,
): Promise<boolean> {
  try {
    const response = await fetch(`${url}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        u: username,
        t: genPasswordToken(password),
        s: saltWord,
      }),
    })

    return response.ok
  } catch {
    return false
  }
}

export async function logout() {
  try {
    await fetch(getBackendUrl('/api/logout'), { method: 'POST' })
  } catch {
    // the cookie runs out by itself
  }
}
