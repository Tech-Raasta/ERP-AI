import ApiService from './ApiService'

export async function apiComboBoxGet(data) {
    const { pageIndex, pageSize, query, sort, status } = data;
    return ApiService.fetchData({
        url: `/combo_box?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}&status=${status || 'approved'}`,
        method: 'GET',
    })
}

export async function apiComboBoxMasterData() {
    return ApiService.fetchData({
        url: `/combo_box/getMasterData`,
        method: 'GET',
    })
}

export async function apiComboBoxGetSingle(data) {
    return ApiService.fetchData({
        url: `/combo_box/${data}`,
        method: 'GET',
    })
}

export async function apiComboBoxPost(data) {
    return ApiService.fetchData({
        url: `/combo_box`,
        method: 'POST',
        data,
    })
}

export async function apiComboBoxUpdate(data) {
    const { id, values } = data;
    return ApiService.fetchData({
        url: `/combo_box/${id}`,
        method: 'PUT',
        data: values,
    })
}
