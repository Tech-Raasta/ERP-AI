import ApiService from './ApiService'

export async function apiBoxGet(data) {
    const { pageIndex, pageSize, query, sort, status } = data;
    return ApiService.fetchData({
        url: `/box?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}&status=${status || 'approved'}`,
        method: 'GET',
    })
}

export async function apiBoxMasterData() {
    return ApiService.fetchData({
        url: `/box/getMasterData`,
        method: 'GET',
    })
}

export async function apiBoxGetSingle(data) {
    return ApiService.fetchData({
        url: `/box/${data}`,
        method: 'GET',
    })
}

export async function apiBoxPost(data) {
    return ApiService.fetchData({
        url: `/box`,
        method: 'POST',
        data,
    })
}

export async function apiBoxUpdate(data) {
    const { id, values } = data;
    return ApiService.fetchData({
        url: `/box/${id}`,
        method: 'PUT',
        data: values,
    })
}
