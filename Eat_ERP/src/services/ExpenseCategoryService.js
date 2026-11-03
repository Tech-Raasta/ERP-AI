import ApiService from './ApiService'

export async function apiExpenseCategoryGet(data) {
    const { pageIndex, pageSize, query, sort, status } = data;
    return ApiService.fetchData({
        url: `/expense_category?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}&status=${status}`,
        method: 'GET',
        data,
    })
}

export async function apiExpenseCategoryGetAll() {
    return ApiService.fetchData({
        url: `/expense_category`,
        method: 'GET',
    }).then(data => {
        return data.data
    })
}

export async function apiExpenseCategoryGetSingle(data) {
    return ApiService.fetchData({
        url: `/expense_category/${data}`,
        method: 'GET',
    })
}

export async function apiExpenseCategoryPost(data) {
    return ApiService.fetchData({
        url: `/expense_category`,
        method: 'POST',
        data,
    })
}

export async function apiExpenseCategoryUpdate(data) {
    const { id, values } = data;
    return ApiService.fetchData({
        url: `/expense_category/${id}`,
        method: 'PUT',
        data: values,
    })
}

export async function apiExpenseCategoryDelete(data) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/expense_category/${data}`,
        method: 'DELETE',
    })
}