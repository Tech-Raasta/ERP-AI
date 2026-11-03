import ApiService from './ApiService'

export async function apiPincodeGet(data) {
    const { pageIndex, pageSize, query, sort } = data;
    return ApiService.fetchData({
        url: `/pincode?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}`,
        method: 'GET',
    })
}

export async function apiPincodeMasterData() {
    return ApiService.fetchData({
        url: `/pincode/getMasterData`,
        method: 'GET',
    })
}

export async function apiPincodeGetSingle(data) {
    return ApiService.fetchData({
        url: `/pincode/${data}`,
        method: 'GET',
    })
}

export async function apiPincodePost(data) {
    return ApiService.fetchData({
        url: `/pincode`,
        method: 'POST',
        data,
    })
}

export async function apiPincodeUpdate(data) {
    const { id, values } = data;
    return ApiService.fetchData({
        url: `/pincode/${id}`,
        method: 'PUT',
        data: values,
    })
}

export async function apiPincodeDelete(data) {
    return ApiService.fetchData({
        url: `/pincode/${data}`,
        method: 'DELETE',
    })
}
