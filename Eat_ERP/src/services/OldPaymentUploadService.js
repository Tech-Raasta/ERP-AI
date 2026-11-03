import ApiService from './ApiService'

// Old Payment Upload (Transaction -> Bank, old PHP Payment_upload)

export async function apiOldPaymentUploadGet({ pageIndex, pageSize, query, sort }) {
    return ApiService.fetchData({
        url: '/old_payment_upload',
        method: 'GET',
        params: {
            pageIndex: pageIndex - 1,
            pageSize,
            query,
            key: sort && sort.key,
            order: sort && sort.order,
        },
    })
}

// The Normal upload format with its drop-down lists, as a file
export async function apiOldPaymentUploadFormat() {
    return ApiService.fetchData({ url: '/old_payment_upload/format', method: 'GET', responseType: 'blob' })
}

// Uploads the file and reads its rows straight away
export async function apiOldPaymentUploadPost(file, uploadType) {
    const data = new FormData()
    data.append('upload_type', uploadType)
    data.append('upload', file)
    return ApiService.fetchData({ url: '/old_payment_upload', method: 'POST', data, headers: { 'Content-Type': 'multipart/form-data' } })
}

// Reads the rows of a file that is still marked Uploading
export async function apiOldPaymentUploadProcess(id) {
    return ApiService.fetchData({ url: `/old_payment_upload/process/${id}`, method: 'POST' })
}

export async function apiOldPaymentUploadApprove(id) {
    return ApiService.fetchData({ url: `/old_payment_upload/approve/${id}`, method: 'PUT' })
}

export async function apiOldPaymentUploadReject(id) {
    return ApiService.fetchData({ url: `/old_payment_upload/reject/${id}`, method: 'PUT' })
}

// Receipt vouchers of an approved file (printable HTML)
export async function apiOldPaymentUploadSlips(id) {
    return ApiService.fetchData({ url: `/old_payment_upload/slips/${id}`, method: 'GET' })
}

// Credit / debit notes of an approved file (printable HTML)
export async function apiOldPaymentUploadNotes(id) {
    return ApiService.fetchData({ url: `/old_payment_upload/notes/${id}`, method: 'GET' })
}
