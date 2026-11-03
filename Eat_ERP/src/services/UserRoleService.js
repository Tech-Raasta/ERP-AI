import ApiService from './ApiService'

// User Roles (User -> User Roles, old PHP User_roles)

export async function apiUserRolesGet({ pageIndex, pageSize, query }) {
    return ApiService.fetchData({
        url: '/user_roles',
        method: 'GET',
        params: { pageIndex: pageIndex - 1, pageSize, query },
    })
}

// The modules and reports the form offers
export async function apiUserRoleMasterData() {
    return ApiService.fetchData({ url: '/user_roles/master', method: 'GET' })
}

export async function apiUserRoleGetSingle(id) {
    return ApiService.fetchData({ url: `/user_roles/${id}`, method: 'GET' })
}

export async function apiUserRolePost(data) {
    return ApiService.fetchData({ url: '/user_roles', method: 'POST', data })
}

export async function apiUserRoleUpdate(id, data) {
    return ApiService.fetchData({ url: `/user_roles/${id}`, method: 'PUT', data })
}
