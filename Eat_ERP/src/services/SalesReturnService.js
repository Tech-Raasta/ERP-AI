import ApiService from './ApiService'

// Sales Return (old PHP Distributor_in)

export async function apiSalesReturnGet(data) {
    const { pageIndex, pageSize, query, sort, status } = data
    return ApiService.fetchData({
        url: `/sales_return?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort['key']}&order=${sort['order']}&status=${status || 'approved'}`,
        method: 'GET',
    })
}

export async function apiSalesReturnGetSingle(id) {
    return ApiService.fetchData({ url: `/sales_return/${id}`, method: 'GET' })
}

// date: batches are those made within 9 months before it
export async function apiSalesReturnMasterData(date) {
    return ApiService.fetchData({ url: `/sales_return/getMasterData?date=${date || ''}`, method: 'GET' })
}

export async function apiSalesReturnInvoices(distributorId) {
    return ApiService.fetchData({ url: `/sales_return/invoices?distributor_id=${distributorId || ''}`, method: 'GET' })
}

export async function apiSalesReturnInvoiceDetails(invoiceNo) {
    return ApiService.fetchData({ url: `/sales_return/invoiceDetails?invoice_no=${encodeURIComponent(invoiceNo)}`, method: 'GET' })
}

export async function apiSalesReturnItemDetails(type, id, distributorId) {
    return ApiService.fetchData({
        url: `/sales_return/itemDetails?type=${encodeURIComponent(type)}&id=${id}&distributor_id=${distributorId || ''}`,
        method: 'GET',
    })
}

export async function apiSalesReturnPost(data) {
    return ApiService.fetchData({ url: '/sales_return', method: 'POST', data })
}

export async function apiSalesReturnUpdate(id, data) {
    return ApiService.fetchData({ url: `/sales_return/${id}`, method: 'PUT', data })
}

export async function apiSalesReturnDelete(id) {
    return ApiService.fetchData({ url: `/sales_return/${id}`, method: 'DELETE' })
}

export async function apiSalesReturnApprove(id, remarks) {
    return ApiService.fetchData({ url: `/sales_return/${id}/approve`, method: 'POST', data: { remarks } })
}

export async function apiSalesReturnReject(id, remarks) {
    return ApiService.fetchData({ url: `/sales_return/${id}/reject`, method: 'POST', data: { remarks } })
}

// Printable HTML { html }
export async function apiSalesReturnReceipt(id) {
    return ApiService.fetchData({ url: `/sales_return/${id}/receipt`, method: 'GET' })
}
