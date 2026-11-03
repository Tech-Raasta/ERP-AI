import ApiService from './ApiService'

export async function apiLocationGet(data) {
    const { pageIndex, pageSize, query, sort } = data;
    return ApiService.fetchData({
        url: `/location?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}`,
        method: 'GET',
    })
}

export async function apiLocationMasterData() {
    return ApiService.fetchData({
        url: `/location/getMasterData`,
        method: 'GET',
    })
}

export async function apiLocationPost(data) {
    return ApiService.fetchData({
        url: `/location`,
        method: 'POST',
        data,
    })
}

export async function apiLocationUpdate(data) {
    const { id, values } = data;
    return ApiService.fetchData({
        url: `/location/${id}`,
        method: 'PUT',
        data: values,
    })
}
