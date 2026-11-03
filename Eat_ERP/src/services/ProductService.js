import ApiService from './ApiService'

export async function apiProductGet(data) {
    const { pageIndex, pageSize, query, sort, status } = data;
    return ApiService.fetchData({
        url: `/product?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}&status=${status || 'approved'}`,
        method: 'GET',
    })
}

export async function apiProductMasterData() {
    return ApiService.fetchData({
        url: `/product/getMasterData`,
        method: 'GET',
    })
}

export async function apiProductGetSingle(data) {
    return ApiService.fetchData({
        url: `/product/${data}`,
        method: 'GET',
    })
}

export async function apiProductPost(data) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/product`,
        method: 'POST',
        data,
    })
}
export async function apiProductUpdate(data) {
    const { id, values } = data;
    return ApiService.fetchData({
        url: `/product/${id}`,
        method: 'PUT',
        data: values,
    })
}

export async function apiProductDelete(data) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/product/${data}`,
        method: 'DELETE',
    })
}
