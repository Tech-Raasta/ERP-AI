import ApiService from './ApiService'

export async function apiRecipeGet(data) {
    const { pageIndex, pageSize, query, sort } = data;
    return ApiService.fetchData({
        url: `/recipe?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}`,
        method: 'GET',
    })
}

export async function apiRecipeMasterData() {
    return ApiService.fetchData({
        url: `/recipe/getMasterData`,
        method: 'GET',
    })
}

export async function apiRecipeGetSingle(data) {
    return ApiService.fetchData({
        url: `/recipe/${data}`,
        method: 'GET',
    })
}

export async function apiRecipePost(data) {
    return ApiService.fetchData({
        url: `/recipe`,
        method: 'POST',
        data,
    })
}

export async function apiRecipeUpdate(data) {
    const { id, values } = data;
    return ApiService.fetchData({
        url: `/recipe/${id}`,
        method: 'PUT',
        data: values,
    })
}
