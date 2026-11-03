import ApiService from './ApiService'

export async function apiAreaGet(data) {
    const { pageIndex, pageSize, query, sort } = data;
    return ApiService.fetchData({
        url: `/area?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}`,
        method: 'GET',
    })
}

export async function apiAreaMasterData() {
    return ApiService.fetchData({
        url: `/area/getMasterData`,
        method: 'GET',
    })
}

export async function apiAreaPost(data) {
    return ApiService.fetchData({
        url: `/area`,
        method: 'POST',
        data,
    })
}

export async function apiAreaUpdate(data) {
    const { id, values } = data;
    return ApiService.fetchData({
        url: `/area/${id}`,
        method: 'PUT',
        data: values,
    })
}
