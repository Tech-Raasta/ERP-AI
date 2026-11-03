import ApiService from './ApiService'

export async function apiSalesRepGet(data) {
    const { pageIndex, pageSize, query, sort, status } = data;
    return ApiService.fetchData({
        url: `/sales_rep?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}&status=${status || 'salesrep'}`,
        method: 'GET',
    })
}

export async function apiSalesRepMasterData() {
    return ApiService.fetchData({
        url: `/sales_rep/getMasterData`,
        method: 'GET',
    })
}

export async function apiSalesRepGetSingle(data) {
    return ApiService.fetchData({
        url: `/sales_rep/${data}`,
        method: 'GET',
    })
}

// data is a FormData (sales rep fields + docs JSON + doc_file_<row> files)
export async function apiSalesRepPost(data) {
    return ApiService.fetchData({
        url: `/sales_rep`,
        method: 'POST',
        data,
    })
}

export async function apiSalesRepUpdate(data) {
    const { id, values } = data;
    return ApiService.fetchData({
        url: `/sales_rep/${id}`,
        method: 'PUT',
        data: values,
    })
}
