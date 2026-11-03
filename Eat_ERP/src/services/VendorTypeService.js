import ApiService from './ApiService'

export async function apiVendorTypeGet(data) {
    const { pageIndex, pageSize, query, sort } = data;
    return ApiService.fetchData({
        url: `/vendor_type?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}`,
        method: 'GET',
    })
}

export async function apiVendorTypePost(data) {
    return ApiService.fetchData({
        url: `/vendor_type`,
        method: 'POST',
        data,
    })
}

export async function apiVendorTypeUpdate(data) {
    const { id, values } = data;
    return ApiService.fetchData({
        url: `/vendor_type/${id}`,
        method: 'PUT',
        data: values,
    })
}
