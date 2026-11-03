import ApiService from './ApiService'

// Sales (old PHP Distributor_out). Phase 1: list and view. Phase 2: add / edit / delete.

export async function apiSalesGet(data) {
    const { pageIndex, pageSize, query, sort, status } = data;
    return ApiService.fetchData({
        url: `/sales?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}&status=${status || 'approved'}`,
        method: 'GET',
    })
}

// id: '<id>' or 'd_<id>'
export async function apiSalesGetSingle(data) {
    return ApiService.fetchData({
        url: `/sales/${data}`,
        method: 'GET',
    })
}

export async function apiSalesMasterData() {
    return ApiService.fetchData({
        url: `/sales/getMasterData`,
        method: 'GET',
    })
}

// Rate, grams, tax % and the distributor's margins of a Bar / Box / Combo Box
export async function apiSalesItemDetails(type, id, distributorId) {
    return ApiService.fetchData({
        url: `/sales/itemDetails?type=${encodeURIComponent(type)}&id=${id}&distributor_id=${distributorId || ''}`,
        method: 'GET',
    })
}

// Shipping addresses (consignees) of a distributor
export async function apiSalesConsignees(distributorId) {
    return ApiService.fetchData({
        url: `/sales/consignees/${distributorId}`,
        method: 'GET',
    })
}

export async function apiSalesPost(data) {
    return ApiService.fetchData({
        url: '/sales',
        method: 'POST',
        data,
    })
}

export async function apiSalesUpdate(data) {
    return ApiService.fetchData({
        url: `/sales/${data.id}`,
        method: 'PUT',
        data: data.values,
    })
}

export async function apiSalesDelete(id) {
    return ApiService.fetchData({
        url: `/sales/${id}`,
        method: 'DELETE',
    })
}

export async function apiSalesApprove(id, remarks) {
    return ApiService.fetchData({
        url: `/sales/${id}/approve`,
        method: 'POST',
        data: { remarks },
    })
}

export async function apiSalesReject(id, remarks) {
    return ApiService.fetchData({
        url: `/sales/${id}/reject`,
        method: 'POST',
        data: { remarks },
    })
}

// Phase 4: gate pass, delivery and printouts

export async function apiSalesDispatchGet(id) {
    return ApiService.fetchData({
        url: `/sales/${id}/dispatch`,
        method: 'GET',
    })
}

// data: FormData (sales_rep_id, tracking_id, date_of_dispatch, batches JSON, proof_of_dispatch file)
export async function apiSalesDispatch(id, data) {
    return ApiService.fetchData({
        url: `/sales/${id}/dispatch`,
        method: 'PUT',
        data,
    })
}

// data: FormData (delivery_status, delivery_date, person_receiving, proof_of_delivery file)
export async function apiSalesDelivery(id, data) {
    return ApiService.fetchData({
        url: `/sales/${id}/delivery`,
        method: 'PUT',
        data,
    })
}

// Printable HTML { html }
export async function apiSalesInvoice(id) {
    return ApiService.fetchData({
        url: `/sales/${id}/invoice`,
        method: 'GET',
    })
}

export async function apiSalesGatePass(id) {
    return ApiService.fetchData({
        url: `/sales/${id}/gatePass`,
        method: 'GET',
    })
}
