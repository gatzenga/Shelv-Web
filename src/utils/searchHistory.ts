// The recent searches of the Shelv app (SearchHistoryStore), kept per browser
const storageKey = 'shelv_search_history_v1'

export const MAX_SEARCH_HISTORY = 20

function normalized(query: string) {
  return query.split(/\s+/).filter(Boolean).join(' ')
}

function matches(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: 'base' }) === 0
}

function save(entries: string[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(entries))
  } catch {
    // storage is not available, the history only lasts for this visit
  }
  return entries
}

export function getSearchHistory(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((entry): entry is string => typeof entry === 'string')
      .slice(0, MAX_SEARCH_HISTORY)
  } catch {
    return []
  }
}

// A search the user picked or opened a result of: moves to the top
export function recordSearch(rawQuery: string) {
  const query = normalized(rawQuery)
  if (!query) return getSearchHistory()

  const history = getSearchHistory().filter((entry) => !matches(entry, query))

  return save([query, ...history].slice(0, MAX_SEARCH_HISTORY))
}

// A search that finished while typing. The one recorded for the letters typed
// a moment ago ("t", "ti", "tim") is replaced, so they do not fill the list.
// `provisional` is what this call recorded, to be replaced by the next one.
export function recordSearchAutomatically(
  rawQuery: string,
  replacing: string | null,
) {
  const query = normalized(rawQuery)
  if (!query) return { entries: getSearchHistory(), provisional: null }

  const provisional = replacing ? normalized(replacing) || null : null
  let history = getSearchHistory()

  const wasAlreadyCommitted = history.some(
    (entry) =>
      matches(entry, query) && (!provisional || !matches(entry, provisional)),
  )

  if (provisional) {
    history = history.filter((entry) => !matches(entry, provisional))
  }
  history = history.filter((entry) => !matches(entry, query))

  return {
    entries: save([query, ...history].slice(0, MAX_SEARCH_HISTORY)),
    provisional: wasAlreadyCommitted ? null : query,
  }
}

export function clearSearchHistory() {
  try {
    localStorage.removeItem(storageKey)
  } catch {
    // nothing stored then
  }
  return []
}
