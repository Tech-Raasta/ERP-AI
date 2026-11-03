import React, { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import Loading from 'components/shared/Loading'
import { onSignInSuccess, onSignOutSuccess } from 'store/auth/sessionSlice'
import { setUser, initialState } from 'store/auth/userSlice'
import { setMenu, menuState } from 'store/auth/menuSlice'
import { userFrom, menuFrom } from 'utils/hooks/useAuth'
import { refresh, onSessionEvent } from 'utils/session'
import { PERSIST_STORE_NAME } from 'constants/app.constant'
import { showError } from 'utils/apiError'

// Opens the app: the httpOnly cookie, if any, gives back the session (a fresh access token and the user's current
// role) before any page draws, so nothing waits on a stale copy of the user. Afterwards it keeps the store in step with
// refreshes, sign-outs in other tabs and a session the server has ended.

// Sessions used to be kept in localStorage (token included): that copy goes
const dropOldSession = () => {
    try {
        const raw = localStorage.getItem(PERSIST_STORE_NAME)
        if (!raw) return
        const saved = JSON.parse(raw)
        if (saved && saved.auth) {
            delete saved.auth
            localStorage.setItem(PERSIST_STORE_NAME, JSON.stringify(saved))
        }
    } catch (e) {
        // Unreadable storage: nothing of the session can be in it either
    }
}

const SessionBoot = ({ children }) => {
    const dispatch = useDispatch()
    const [ready, setReady] = useState(false)

    useEffect(() => {
        dropOldSession()
        const signIn = (data) => {
            dispatch(setUser(userFrom(data)))
            dispatch(setMenu(menuFrom(data)))
            dispatch(onSignInSuccess())
        }
        const signOut = () => {
            dispatch(onSignOutSuccess())
            dispatch(setUser(initialState))
            dispatch(setMenu(menuState))
        }
        const stop = onSessionEvent((event) => {
            if (event.type === 'refreshed') signIn(event.data)
            if (event.type === 'ended') {
                signOut()
                if (event.fromOtherTab) showError('You signed out in another tab.', 'Signed out')
            }
            // Signed in in another tab: this one picks the session up from the shared cookie
            if (event.type === 'signin-elsewhere') refresh().catch(() => {})
        })
        refresh()
            .catch(() => signOut())
            .finally(() => setReady(true))
        return stop
    }, [dispatch])

    if (!ready) {
        return (
            <div className="flex flex-auto flex-col h-[100vh]">
                <Loading loading={true} />
            </div>
        )
    }
    return children
}

export default SessionBoot
