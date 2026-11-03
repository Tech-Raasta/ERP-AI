import ApiService from './ApiService'

export async function apiSignIn(data) {
    return ApiService.fetchData({
        url: '/user/login',
        method: 'post',
        data,
    })
}

export async function apiSignUp(data) {
    return ApiService.fetchData({
        url: '/sign-up',
        method: 'post',
        data,
    })
}

export async function apiSetFavourites(data) {
    return ApiService.fetchData({
        url: `/user/setFavourites/${data.id}`,
        method: 'put',
        data,
    })
}

// Ends the session on the server too: the token stops working everywhere
export async function apiSignOut() {
    return ApiService.fetchData({
        url: '/user/logout',
        method: 'post',
    })
}

// The signed-in user with their current role flags (a role changed since sign-in counts at once)
export async function apiMe() {
    return ApiService.fetchData({
        url: '/user/me',
        method: 'get',
    })
}

// Forgot password: a link to set a new one is mailed (controllers/passwordReset.js)
export async function apiForgotPassword(data) {
    return ApiService.fetchData({
        url: '/user/forgot-password',
        method: 'post',
        data,
    })
}

// The reset link from that mail: is it still valid?
export async function apiCheckResetLink(data) {
    return ApiService.fetchData({
        url: '/user/reset-link/check',
        method: 'post',
        data,
    })
}

// The new password, with the link's token
export async function apiResetPasswordWithLink(data) {
    return ApiService.fetchData({
        url: '/user/reset-link/save',
        method: 'post',
        data,
    })
}

export async function apiResetPassword(data, id) {
    return ApiService.fetchData({
        url: `/user/reset-password/${id}`,
        method: 'post',
        data,
    })
}
