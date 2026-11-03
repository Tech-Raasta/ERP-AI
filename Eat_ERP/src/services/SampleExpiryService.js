import ApiService from './ApiService'

// Sample / Expiry (old PHP Sample_out)

export async function apiSampleGet(data) {
    const { pageIndex, pageSize, query, sort, status } = data
    return ApiService.fetchData({
        url: `/sample_out?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort['key']}&order=${sort['order']}&status=${status || 'pending_for_delivery'}`,
        method: 'GET',
    })
}

export async function apiSampleGetSingle(id) {
    return ApiService.fetchData({
        url: `/sample_out/${id}`,
        method: 'GET',
    })
}

export async function apiSampleMasterData() {
    return ApiService.fetchData({
        url: `/sample_out/getMasterData`,
        method: 'GET',
    })
}

// Cost (Box / Bar) or rate (Combo Box) and grams of an item
export async function apiSampleItemDetails(type, id) {
    return ApiService.fetchData({
        url: `/sample_out/itemDetails?type=${encodeURIComponent(type)}&id=${id}`,
        method: 'GET',
    })
}

export async function apiSamplePost(data) {
    return ApiService.fetchData({
        url: '/sample_out',
        method: 'POST',
        data,
    })
}

// data: JSON, or FormData (payload JSON + receivable_doc_file) when a receivable document is attached
export async function apiSampleUpdate(id, data) {
    return ApiService.fetchData({
        url: `/sample_out/${id}`,
        method: 'PUT',
        data,
    })
}

export async function apiSampleDelete(id) {
    return ApiService.fetchData({
        url: `/sample_out/${id}`,
        method: 'DELETE',
    })
}

export async function apiSampleApprove(id, remarks) {
    return ApiService.fetchData({
        url: `/sample_out/${id}/approve`,
        method: 'POST',
        data: { remarks },
    })
}

export async function apiSampleReject(id, remarks) {
    return ApiService.fetchData({
        url: `/sample_out/${id}/reject`,
        method: 'POST',
        data: { remarks },
    })
}

export async function apiSampleDispatchGet(id) {
    return ApiService.fetchData({
        url: `/sample_out/${id}/dispatch`,
        method: 'GET',
    })
}

// data: FormData (sales_rep_id, batches JSON)
export async function apiSampleDispatch(id, data) {
    return ApiService.fetchData({
        url: `/sample_out/${id}/dispatch`,
        method: 'PUT',
        data,
    })
}

export async function apiSampleDelivery(id, data) {
    return ApiService.fetchData({
        url: `/sample_out/${id}/delivery`,
        method: 'PUT',
        data,
    })
}

// Printable HTML { html }
export async function apiSampleVoucher(id) {
    return ApiService.fetchData({
        url: `/sample_out/${id}/voucher`,
        method: 'GET',
    })
}

export async function apiSampleGatePass(id) {
    return ApiService.fetchData({
        url: `/sample_out/${id}/gatePass`,
        method: 'GET',
    })
}
