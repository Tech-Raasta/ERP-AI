import axios from 'axios'
import appConfig from 'configs/app.config'
import { TOKEN_TYPE, REQUEST_HEADER_AUTH_KEY } from 'constants/api.constant'
import { getAccessToken, tokenIsFresh, refresh, endSession } from 'utils/session'
import { NO_NETWORK, defaultMessage, notifiedStatus, showError } from 'utils/apiError'
import store from '../store'
import { onSignOutSuccess, checkExpiry } from '../store/auth/sessionSlice'

const unauthorizedCode = [400]
// 403 is the expired password: the reset dialog opens instead of a message
const PASSWORD_EXPIRED = 403

const BaseService = axios.create({
    timeout: 900000,
    baseURL: appConfig.apiPrefix,
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    // headers: { 'Content-Type': 'multipart/form-data;' }
})

// 400 with this code: the access token ran out (every 15 minutes); anything else at 400 ends the session
const TOKEN_EXPIRED = 'TOKEN_EXPIRED'

BaseService.interceptors.request.use(
    async (config) => {
        // A token about to run out is renewed first, saving a failed request
        if (getAccessToken() && !tokenIsFresh()) {
            try {
                await refresh()
            } catch (e) {
                // The answer to the request itself decides what happens next
            }
        }
        const accessToken = getAccessToken()

        if (accessToken) {
            config.headers[
                REQUEST_HEADER_AUTH_KEY
            ] = `${TOKEN_TYPE}${accessToken}`
        }

        return config
    },
    (error) => {
        return Promise.reject(error)
    }
)

// Every failure leaves here as error.response = { status, data: { message, ... } }: no response at all becomes status
// 0, a failed file download is read back from its Blob, an HTML or empty body gets a plain message.
const normalise = async (error) => {
    if (!error.response) {
        error.response = { status: NO_NETWORK, data: {}, headers: {} }
    }
    const { response } = error
    let data = response.data
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
        try {
            data = JSON.parse(await data.text())
        } catch (e) {
            data = {}
        }
    }
    // A plain-text answer (res.send('...')) is the message; an HTML page is not
    if (typeof data === 'string' && data.trim() && !/^\s*</.test(data)) data = { message: data.trim() }
    if (!data || typeof data !== 'object' || Array.isArray(data)) data = {}
    if (!data.message || typeof data.message !== 'string') {
        data.message = defaultMessage(response.status, error.code)
    }
    response.data = data
    return response
}

BaseService.interceptors.response.use(
    (response) => {
        // console.log("response>>>>",response);
        store.dispatch(checkExpiry(null))
        return response
    },
    async (error) => {
        if (axios.isCancel(error)) return Promise.reject(error)
        const response = await normalise(error)

        // Ran out while on its way: renew once and send the same request again
        const original = error.config || {}
        if (response.status === 400 && response.data.code === TOKEN_EXPIRED && !original._renewed) {
            try {
                await refresh()
                original._renewed = true
                original.headers = { ...original.headers, [REQUEST_HEADER_AUTH_KEY]: `${TOKEN_TYPE}${getAccessToken()}` }
                return BaseService(original)
            } catch (e) {
                // No session left: carry on below as a session that has ended
            }
        }

        if (unauthorizedCode.includes(response.status)) {
            // The screen that made the request shows this same message, so it appears once
            response.data.message = defaultMessage(response.status)
            if (store.getState().auth.session.signedIn) showError(response.data.message, 'Signed out')
            // The token goes too, and every other open tab signs out with this one
            endSession()
            store.dispatch(onSignOutSuccess())
        } else if (response.status === PASSWORD_EXPIRED) {
            // console.log("Getting here first", error)
            store.dispatch(checkExpiry(response.data))
        } else if (notifiedStatus(response.status) && store.getState().auth.session.signedIn) {
            showError(response.data.message)
        }
        return Promise.reject(error)
    }
)

export default BaseService
