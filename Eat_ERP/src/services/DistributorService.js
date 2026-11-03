import ApiService from './ApiService'

export async function apiDistributorGet(data) {
    const { pageIndex, pageSize, query, sort, status } = data;
    return ApiService.fetchData({
        url: `/distributor?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}&status=${status || 'distributor'}`,
        method: 'GET',
    })
}

export async function apiDistributorMasterData() {
    return ApiService.fetchData({
        url: `/distributor/getMasterData`,
        method: 'GET',
    })
}

// id: 'd_<id>' (distributor) or 's_<id>' (pending sales rep retailer)
export async function apiDistributorGetSingle(data) {
    return ApiService.fetchData({
        url: `/distributor/${data}`,
        method: 'GET',
    })
}

// data is a FormData (fields + contacts / consignees / margins / beat_ids JSON + doc_file)
export async function apiDistributorPost(data) {
    return ApiService.fetchData({
        url: `/distributor`,
        method: 'POST',
        data,
    })
}

export async function apiDistributorUpdate(data) {
    const { id, values } = data;
    return ApiService.fetchData({
        url: `/distributor/${id}`,
        method: 'PUT',
        data: values,
    })
}
