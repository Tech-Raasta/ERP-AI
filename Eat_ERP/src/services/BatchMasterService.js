import ApiService from './ApiService'

export async function apiBatchMasterGet(data) {
    const { pageIndex, pageSize, query, sort, status } = data;
    return ApiService.fetchData({
        url: `/batch_master?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}&status=${status || 'approved'}`,
        method: 'GET',
    })
}

export async function apiBatchMasterMasterData() {
    return ApiService.fetchData({
        url: `/batch_master/getMasterData`,
        method: 'GET',
    })
}

export async function apiBatchMasterGetSingle(data) {
    return ApiService.fetchData({
        url: `/batch_master/${data}`,
        method: 'GET',
    })
}

// data: batch fields (JSON). The API also accepts a FormData with docs + doc_file_<row> files
export async function apiBatchMasterPost(data) {
    return ApiService.fetchData({
        url: `/batch_master`,
        method: 'POST',
        data,
    })
}

export async function apiBatchMasterUpdate(data) {
    const { id, values } = data;
    return ApiService.fetchData({
        url: `/batch_master/${id}`,
        method: 'PUT',
        data: values,
    })
}
