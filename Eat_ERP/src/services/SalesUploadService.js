import ApiService from './ApiService'

// Sales Upload (old PHP Sales_upload)

export async function apiSalesUploadGet({ pageIndex, pageSize, query, sort }) {
    return ApiService.fetchData({
        url: '/sale_upload',
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

// The upload format with its drop-down lists, as a file
export async function apiSalesUploadFormat() {
    return ApiService.fetchData({ url: '/sale_upload/format', method: 'GET', responseType: 'blob' })
}

// Uploads the file and reads its rows straight away
export async function apiSalesUploadPost(file) {
    const data = new FormData()
    data.append('upload', file)
    return ApiService.fetchData({ url: '/sale_upload', method: 'POST', data, headers: { 'Content-Type': 'multipart/form-data' } })
}

// Reads the rows of a file that is still marked Uploading
export async function apiSalesUploadProcess(id) {
    return ApiService.fetchData({ url: `/sale_upload/process/${id}`, method: 'POST' })
}

export async function apiSalesUploadApprove(id) {
    return ApiService.fetchData({ url: `/sale_upload/approve/${id}`, method: 'PUT' })
}

export async function apiSalesUploadReject(id) {
    return ApiService.fetchData({ url: `/sale_upload/reject/${id}`, method: 'PUT' })
}

// Tax invoices of an approved file (printable HTML)
export async function apiSalesUploadInvoices(id) {
    return ApiService.fetchData({ url: `/sale_upload/invoices/${id}`, method: 'GET' })
}
