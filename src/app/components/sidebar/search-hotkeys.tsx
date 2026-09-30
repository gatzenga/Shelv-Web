import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/routes/routesList'

// The keys that used to open the search dialog now open the search page
export function SearchHotkeys() {
  const navigate = useNavigate()

  useHotkeys(['/', 'mod+f', 'mod+k'], () => navigate(ROUTES.LIBRARY.SEARCH), {
    preventDefault: true,
  })

  return null
}
