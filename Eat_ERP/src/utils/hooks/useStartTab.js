import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'

// The tab a list opens on: ?status=<tab> from a link (the home page links straight to "Pending"), else the default
const useStartTab = (tabs, fallback) => {
    const { search } = useLocation()
    return useMemo(() => {
        const wanted = new URLSearchParams(search).get('status')
        return tabs.some((tab) => tab.value === wanted) ? wanted : fallback
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
}

export default useStartTab
