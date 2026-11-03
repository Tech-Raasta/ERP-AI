import ApiService from './ApiService'

export async function apiCategoryGet(data) {
    const { pageIndex, pageSize, query, sort } = data;
    return ApiService.fetchData({
        url: `/category?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}`,
        method: 'GET',
    })
}

export async function apiCategoryGetAll() {
    return ApiService.fetchData({
        url: `/category`,
        method: 'GET',
    }).then(data => {
        return data.data
    })
}

export async function apiCategoryGetSingle(data) {
    return ApiService.fetchData({
        url: `/category/${data}`,
        method: 'GET',
    })
}

export async function apiCategoryPost(data) {
    return ApiService.fetchData({
        url: `/category`,
        method: 'POST',
        data,
    })
}

export async function apiCategoryUpdate(data) {
    const { id, values } = data;
    return ApiService.fetchData({
        url: `/category/${id}`,
        method: 'PUT',
        data: values,
    })
}

export async function apiCategoryDelete(data) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/category/${data}`,
        method: 'DELETE',
    })
}