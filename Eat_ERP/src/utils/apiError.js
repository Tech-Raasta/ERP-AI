import React from 'react'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'

// One place for what a failed request means to the user. BaseService fills in a message for every failure (no
// network, timeout, an HTML or empty error page, a file download that failed), so screens reading
// error.response.data.message always have something to show and never crash on a missing response.

export const NO_NETWORK = 0

const DEFAULT_MESSAGES = {
    [NO_NETWORK]: 'The server could not be reached. Check your internet connection and try again.',
    400: 'Your session has ended. Please sign in again.',
    401: 'You do not have access to this.',
    404: 'What you asked for was not found.',
    408: 'The server took too long to answer. Please try again.',
    413: 'The file or data sent is too large.',
    429: 'Too many requests. Please wait a moment and try again.',
}
const SERVER_ERROR = 'Something went wrong on the server. Please try again.'
const TIMEOUT = 'The server took too long to answer. Please try again.'

export const defaultMessage = (status, code) => {
    if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') return TIMEOUT
    if (DEFAULT_MESSAGES[status]) return DEFAULT_MESSAGES[status]
    return status >= 500 ? SERVER_ERROR : 'The request failed. Please try again.'
}

// Failures no screen can fix shown here as well; validation and business errors (422, 409, 402 ...) are left to the
// screen, which knows the fields. A screen showing the same message again is merged by toast.
export const notifiedStatus = (status) => [NO_NETWORK, 400, 401, 404, 408, 413, 429].includes(status) || status >= 500

export const showError = (message, title = 'Error') => {
    toast.push(
        <Notification title={title} type="danger" closable>
            {message}
        </Notification>
    )
}
