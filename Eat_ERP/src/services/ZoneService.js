import ApiService from './ApiService'

export async function apiZoneGet(data) {
    const { pageIndex, pageSize, query, sort } = data;
    return ApiService.fetchData({
        url: `/zone?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}`,
        method: 'GET',
    })
}

export async function apiZoneMasterData() {
    return ApiService.fetchData({
        url: `/zone/getMasterData`,
        method: 'GET',
    })
}

export async function apiZonePost(data) {
    return ApiService.fetchData({
        url: `/zone`,
        method: 'POST',
        data,
    })
}

export async function apiZoneUpdate(data) {
    const { id, values } = data;
    return ApiService.fetchData({
        url: `/zone/${id}`,
        method: 'PUT',
        data: values,
    })
}
