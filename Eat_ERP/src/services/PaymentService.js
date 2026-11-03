import ApiService from './ApiService'

// Payment Details (Transaction -> Bank, old PHP Payment)

export async function apiPaymentsGet({ pageIndex, pageSize, query, status }) {
    return ApiService.fetchData({
        url: '/payment',
        method: 'GET',
        params: { pageIndex: pageIndex - 1, pageSize, query, status },
    })
}

export async function apiPaymentMasterData() {
    return ApiService.fetchData({ url: '/payment/master', method: 'GET' })
}

// Outstanding and open invoices of a distributor; id / ref_id: this payment (and the entry it changes) are left out
export async function apiPaymentDistributorDetails(distributorId, id, refId) {
    return ApiService.fetchData({
        url: '/payment/distributor',
        method: 'GET',
        params: { distributor_id: distributorId, id: id || 0, ref_id: refId || 0 },
    })
}

export async function apiPaymentGetSingle(id) {
    return ApiService.fetchData({ url: `/payment/${id}`, method: 'GET' })
}

export async function apiPaymentPost(data) {
    return ApiService.fetchData({ url: '/payment', method: 'POST', data })
}

export async function apiPaymentUpdate(id, data) {
    return ApiService.fetchData({ url: `/payment/${id}`, method: 'PUT', data })
}

export async function apiPaymentDelete(id, remarks) {
    return ApiService.fetchData({ url: `/payment/${id}`, method: 'DELETE', data: { remarks } })
}

export async function apiPaymentApprove(id, remarks) {
    return ApiService.fetchData({ url: `/payment/approve/${id}`, method: 'PUT', data: { remarks } })
}

export async function apiPaymentReject(id, remarks) {
    return ApiService.fetchData({ url: `/payment/reject/${id}`, method: 'PUT', data: { remarks } })
}

// Receipt voucher of an approved payment (printable HTML)
export async function apiPaymentSlip(id) {
    return ApiService.fetchData({ url: `/payment/slip/${id}`, method: 'GET' })
}
