// Builds before the login with a cookie kept the password token of the user in
// the browser (data.password). Whoever reads the storage of the page could sign
// in with it. Nothing of a login is kept there any more, and what an old build
// left behind is removed the next time the store is read.
export function withoutStoredLogin<T extends object>(state: T): T {
  const { data, ...rest } = state as { data?: Record<string, unknown> }
  if (!data) return state

  const { password: _password, authType: _authType, ...kept } = data

  return { ...rest, data: kept } as T
}
