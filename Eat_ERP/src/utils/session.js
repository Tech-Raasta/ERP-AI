import axios from 'axios'
import appConfig from 'configs/app.config'

// The sign-in session in the browser (backend: lib/authTokens.js).
//  - The access token (15 minutes) lives only in this module's memory: not in localStorage, not in the redux store,
//    so nothing that reads storage can take it. A page reload loses it; the httpOnly refresh cookie brings it back.
//  - refresh() asks /user/refresh for a new one. One refresh at a time: everybody waiting shares it.
//  - It is renewed a minute before it runs out, and again when the tab comes back after being hidden.
//  - Open tabs of the ERP share it (BroadcastChannel): a refresh, sign-in or sign-out in one tab reaches the others,
//    so they neither refresh at the same moment nor stay signed in after a sign-out.

const RENEW_BEFORE_MS = 60 * 1000
const CHANNEL = 'eat-erp-session'

let accessToken = ''
let expiresAt = 0
let timer = null
let pending = null
const listeners = new Set()
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null

// Its own client: no interceptors (BaseService's would call refresh again), and the cookie goes with it
const authClient = axios.create({
    baseURL: appConfig.apiPrefix,
    timeout: 30000,
    withCredentials: true,
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
})

const emit = (event) => listeners.forEach((listener) => listener(event))

export const onSessionEvent = (listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

export const getAccessToken = () => accessToken
export const tokenIsFresh = () => !!accessToken && Date.now() < expiresAt - 5000

const schedule = () => {
    clearTimeout(timer)
    if (!accessToken) return
    timer = setTimeout(() => {
        refresh().catch(() => {})
    }, Math.max(5000, expiresAt - Date.now() - RENEW_BEFORE_MS))
}

const adopt = (token, seconds) => {
    accessToken = token
    expiresAt = Date.now() + (seconds || 900) * 1000
    schedule()
}

// After sign-in or refresh (data: the answer, with token and expiresIn)
export const startSession = (data, { broadcast = true } = {}) => {
    adopt(data.token, data.expiresIn)
    if (broadcast && channel) channel.postMessage({ type: 'token', token: data.token, expiresIn: Math.round((expiresAt - Date.now()) / 1000) })
}

export const endSession = ({ broadcast = true } = {}) => {
    accessToken = ''
    expiresAt = 0
    clearTimeout(timer)
    if (broadcast && channel) channel.postMessage({ type: 'signout' })
}

// Resolves with the user's details and a fresh token, or rejects when there is no session (sign in again)
export const refresh = () => {
    if (!pending) {
        pending = authClient
            .post('/user/refresh')
            .then((res) => {
                startSession(res.data)
                emit({ type: 'refreshed', data: res.data })
                return res.data
            })
            .catch((error) => {
                // No session (401) ends it here; a network failure leaves it for the next try
                if (error && error.response && error.response.status === 401) {
                    // A tab that never had a session (a new tab, the sign-in page) must not sign the others out
                    endSession({ broadcast: !!accessToken })
                    emit({ type: 'ended', message: error.response.data && error.response.data.message })
                }
                throw error
            })
            .finally(() => {
                pending = null
            })
    }
    return pending
}

export const signOutOnServer = () => authClient.post('/user/logout').catch(() => {})

export const signInOnServer = (values) => authClient.post('/user/login', values)

if (channel) {
    channel.onmessage = (event) => {
        const message = event.data || {}
        if (message.type === 'token') {
            adopt(message.token, message.expiresIn)
            emit({ type: 'adopted' })
        } else if (message.type === 'signout') {
            endSession({ broadcast: false })
            emit({ type: 'ended', fromOtherTab: true })
        } else if (message.type === 'signin') {
            emit({ type: 'signin-elsewhere' })
        }
    }
}

export const announceSignIn = () => channel && channel.postMessage({ type: 'signin' })

// Back to a tab that slept past the token's end: renew before the user clicks anything
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && accessToken && !tokenIsFresh()) refresh().catch(() => {})
    })
}
