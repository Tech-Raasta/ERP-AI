import ApiService from './ApiService'

// Batch Processing (Transaction -> Production, old PHP Batch_processing)

export async function apiBatchProcessingGet({ pageIndex, pageSize, query, status }) {
    return ApiService.fetchData({
        url: '/batch_processing',
        method: 'GET',
        params: { pageIndex: pageIndex - 1, pageSize, query, status },
    })
}

export async function apiBatchProcessingMasterData() {
    return ApiService.fetchData({ url: '/batch_processing/master', method: 'GET' })
}

// The product's recipe, per batch
export async function apiBatchProcessingRecipe(productId) {
    return ApiService.fetchData({ url: `/batch_processing/recipe/${productId}`, method: 'GET' })
}

export async function apiBatchProcessingBarcodes(ids) {
    return ApiService.fetchData({ url: '/batch_processing/barcodes', method: 'GET', params: { ids: ids.join(',') } })
}

export async function apiBatchProcessingGetSingle(id) {
    return ApiService.fetchData({ url: `/batch_processing/${id}`, method: 'GET' })
}

export async function apiBatchProcessingPost(data) {
    return ApiService.fetchData({ url: '/batch_processing', method: 'POST', data })
}

export async function apiBatchProcessingUpdate(id, data) {
    return ApiService.fetchData({ url: `/batch_processing/${id}`, method: 'PUT', data })
}

export async function apiBatchProcessingDelete(id, remarks) {
    return ApiService.fetchData({ url: `/batch_processing/${id}`, method: 'DELETE', data: { remarks } })
}

export async function apiBatchProcessingApprove(id, remarks) {
    return ApiService.fetchData({ url: `/batch_processing/approve/${id}`, method: 'PUT', data: { remarks } })
}

export async function apiBatchProcessingReject(id, remarks) {
    return ApiService.fetchData({ url: `/batch_processing/reject/${id}`, method: 'PUT', data: { remarks } })
}

export async function apiBatchNoPost(data) {
    return ApiService.fetchData({ url: '/batch_processing/batch_no', method: 'POST', data })
}

// The receipt (printable HTML)
export async function apiBatchProcessingPrint(id) {
    return ApiService.fetchData({ url: `/batch_processing/print/${id}`, method: 'GET' })
}
