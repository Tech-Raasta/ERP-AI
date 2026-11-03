import ApiService from './ApiService'

export async function apiCityGet(data) {
    const { pageIndex, pageSize, query, sort } = data;
    return ApiService.fetchData({
        url: `/city_master?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}`,
        method: 'GET',
    })
}

export async function apiCityMasterData() {
    return ApiService.fetchData({
        url: `/city_master/getMasterData`,
        method: 'GET',
    })
}

export async function apiCityPost(data) {
    return ApiService.fetchData({
        url: `/city_master`,
        method: 'POST',
        data,
    })
}

export async function apiCityUpdate(data) {
    const { id, values } = data;
    return ApiService.fetchData({
        url: `/city_master/${id}`,
        method: 'PUT',
        data: values,
    })
}

export async function apiCityDelete(data) {
    return ApiService.fetchData({
        url: `/city_master/${data}`,
        method: 'DELETE',
    })
}
