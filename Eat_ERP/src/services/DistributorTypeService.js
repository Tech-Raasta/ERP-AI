import ApiService from './ApiService'

export async function apiDistributorTypeGet(data) {
    const { pageIndex, pageSize, query, sort } = data;
    return ApiService.fetchData({
        url: `/distributor_type?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}`,
        method: 'GET',
    })
}

export async function apiDistributorTypePost(data) {
    return ApiService.fetchData({
        url: `/distributor_type`,
        method: 'POST',
        data,
    })
}

export async function apiDistributorTypeUpdate(data) {
    const { id, values } = data;
    return ApiService.fetchData({
        url: `/distributor_type/${id}`,
        method: 'PUT',
        data: values,
    })
}
