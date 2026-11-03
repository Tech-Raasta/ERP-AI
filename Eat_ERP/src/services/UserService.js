import ApiService from './ApiService'

// User (User -> User, old PHP User)

export async function apiUsersGet({ pageIndex, pageSize, query, status }) {
    return ApiService.fetchData({
        url: '/user',
        method: 'GET',
        params: { pageIndex: pageIndex - 1, pageSize, query, status },
    })
}

export async function apiUserMasterData() {
    return ApiService.fetchData({ url: '/user/master', method: 'GET' })
}

export async function apiUserGetSingle(id) {
    return ApiService.fetchData({ url: `/user/${id}`, method: 'GET' })
}

export async function apiUserPost(data) {
    return ApiService.fetchData({ url: '/user', method: 'POST', data })
}

export async function apiUserUpdate(id, data) {
    return ApiService.fetchData({ url: `/user/${id}`, method: 'PUT', data })
}
